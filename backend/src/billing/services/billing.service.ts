import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateInvoiceDto } from '../dto/create-invoice.dto.js';
import { CreatePaymentDto } from '../dto/create-payment.dto.js';
import { CreateRefundDto } from '../dto/create-refund.dto.js';

type Tx = Prisma.TransactionClient;

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  private invoiceNumber() {
    const date = new Date();
    const stamp = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('');
    return `INV-${stamp}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  billableNights(admissionDate: Date, dischargeDate?: Date | null) {
    const start = new Date(admissionDate);
    const end = dischargeDate ? new Date(dischargeDate) : new Date();
    const ms = Math.max(0, end.getTime() - start.getTime());
    return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }

  async createInvoice(dto: CreateInvoiceDto, userId: number) {
    if (!dto.items?.length) {
      throw new BadRequestException('At least one invoice item is required');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const patient = await tx.patient.findUnique({
          where: { id: dto.patientId },
          select: { id: true },
        });

        if (!patient) {
          throw new NotFoundException('Patient not found');
        }

        const seenSources = new Set<string>();
        const validatedItems: {
          description: string;
          quantity: number;
          unitPrice: Prisma.Decimal;
          total: Prisma.Decimal;
          sourceType: string | null;
          sourceId: number | null;
        }[] = [];

        for (const item of dto.items) {
          const sourceType = item.sourceType?.trim() || null;
          const sourceId = item.sourceId ?? null;

          if (sourceType && sourceId !== null) {
            const sourceKey = `${sourceType}:${sourceId}`;
            if (seenSources.has(sourceKey)) {
              throw new BadRequestException(`Duplicate source in invoice: ${sourceKey}`);
            }
            seenSources.add(sourceKey);
          }

          const priced = await this.resolvePricedItem(tx, dto.patientId, {
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            sourceType,
            sourceId,
          });

          validatedItems.push(priced);
        }

        const itemsTotal = validatedItems.reduce(
          (sum, item) => sum.add(item.total),
          new Prisma.Decimal(0),
        );
        const discountAmount = new Prisma.Decimal(dto.discountAmount ?? 0);
        const taxAmount = new Prisma.Decimal(dto.taxAmount ?? 0);
        if (discountAmount.greaterThan(itemsTotal)) {
          throw new BadRequestException('Discount cannot exceed the invoice item total');
        }
        const totalAmount = itemsTotal.sub(discountAmount).add(taxAmount);
        if (totalAmount.lessThan(0)) {
          throw new BadRequestException('Invoice total cannot be negative');
        }

        const invoice = await tx.invoice.create({
          data: {
            invoiceNumber: this.invoiceNumber(),
            totalAmount,
            paidAmount: new Prisma.Decimal(0),
            discountAmount,
            taxAmount,
            status: 'ISSUED',
            verificationStatus: 'DRAFT',
            dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
            notes: dto.notes?.trim() || null,
            patientId: dto.patientId,
            items: { create: validatedItems },
          },
          include: {
            patient: true,
            items: true,
            payments: true,
          },
        });

        await tx.auditLog.create({
          data: {
            action: 'CREATE',
            entity: 'Invoice',
            entityId: String(invoice.id),
            userId,
            newData: {
              invoiceNumber: invoice.invoiceNumber,
              patientId: invoice.patientId,
              totalAmount: invoice.totalAmount.toString(),
              discountAmount: invoice.discountAmount.toString(),
              taxAmount: invoice.taxAmount.toString(),
              itemCount: invoice.items.length,
            },
          },
        });

        return invoice;
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException('Invoice number already exists; please retry');
      }
      if ((error as { code?: string })?.code === 'P2034') {
        throw new ConflictException('Concurrent invoice operation detected; refresh and retry');
      }
      throw error;
    }
  }

  private async resolvePricedItem(
    tx: Tx,
    patientId: number,
    item: {
      description: string;
      quantity: number;
      unitPrice: number;
      sourceType: string | null;
      sourceId: number | null;
    },
  ) {
    let description = item.description.trim();
    let quantity = item.quantity;
    let unitPrice = new Prisma.Decimal(item.unitPrice);
    const sourceType = item.sourceType;
    const sourceId = item.sourceId;

    if (sourceType === 'PRESCRIPTION_ITEM') {
      if (!sourceId) throw new BadRequestException('Prescription item source ID is required');
      const prescriptionItem = await tx.prescriptionItem.findUnique({
        where: { id: sourceId },
        include: { prescription: true, medicine: true },
      });
      if (!prescriptionItem) throw new NotFoundException('Prescription item not found');
      if (prescriptionItem.prescription.patientId !== patientId) {
        throw new BadRequestException('Prescription does not belong to this patient');
      }
      if (prescriptionItem.prescription.verificationStatus !== 'VERIFIED') {
        throw new BadRequestException('Prescription must be verified before billing');
      }
      if (!prescriptionItem.medicine?.active) {
        throw new BadRequestException('Medicine is unavailable');
      }
      const dispensedQuantity = prescriptionItem.dispensedQuantity ?? 0;
      const previousInvoices = await tx.invoiceItem.aggregate({
        where: { sourceType: 'PRESCRIPTION_ITEM', sourceId },
        _sum: { quantity: true },
      });
      const previouslyInvoiced = previousInvoices._sum.quantity ?? 0;
      const remainingQuantity = dispensedQuantity - previouslyInvoiced;
      if (remainingQuantity <= 0) {
        throw new ConflictException('All dispensed medicine has already been invoiced');
      }
      if (quantity > remainingQuantity) {
        throw new BadRequestException(`Only ${remainingQuantity} unbilled units are available`);
      }
      unitPrice = new Prisma.Decimal(prescriptionItem.medicine.sellingPrice);
      description = `Medicine - ${prescriptionItem.medicineName}`;
    } else if (sourceType === 'APPOINTMENT') {
      if (!sourceId) throw new BadRequestException('Appointment source ID is required');
      await this.assertUniqueSource(tx, sourceType, sourceId);
      const appointment = await tx.appointment.findUnique({
        where: { id: sourceId },
        include: { doctor: true },
      });
      if (!appointment) throw new NotFoundException('Appointment not found');
      if (appointment.patientId !== patientId) {
        throw new BadRequestException('Appointment does not belong to this patient');
      }
      if (appointment.status !== 'COMPLETED') {
        throw new BadRequestException('Only completed consultations can be billed');
      }
      quantity = 1;
      unitPrice = new Prisma.Decimal(appointment.consultationFee);
      description = `Consultation fee - ${appointment.appointmentNo}`;
    } else if (sourceType === 'LAB_REQUEST_ITEM') {
      if (!sourceId) throw new BadRequestException('Laboratory item source ID is required');
      await this.assertUniqueSource(tx, sourceType, sourceId);
      const labItem = await tx.labRequestItem.findUnique({
        where: { id: sourceId },
        include: {
          labTest: true,
          result: true,
          labRequest: true,
        },
      });
      if (!labItem) throw new NotFoundException('Laboratory request item not found');
      if (labItem.labRequest.patientId !== patientId) {
        throw new BadRequestException('Laboratory request does not belong to this patient');
      }
      if (!labItem.result?.verifiedAt) {
        throw new BadRequestException('Laboratory results must be verified before billing');
      }
      quantity = 1;
      unitPrice = new Prisma.Decimal(labItem.labTest.price);
      description = `Laboratory test - ${labItem.labTest.name}`;
    } else if (sourceType === 'ADMISSION') {
      if (!sourceId) throw new BadRequestException('Admission source ID is required');
      await this.assertUniqueSource(tx, sourceType, sourceId);
      const admission = await tx.admission.findUnique({
        where: { id: sourceId },
        include: { bed: { include: { room: true } } },
      });
      if (!admission) throw new NotFoundException('Admission not found');
      if (admission.patientId !== patientId) {
        throw new BadRequestException('Admission does not belong to this patient');
      }
      const dailyRate = admission.bed?.room?.dailyRate;
      if (!dailyRate || new Prisma.Decimal(dailyRate).lessThanOrEqualTo(0)) {
        throw new BadRequestException('This admission has no configured room daily rate');
      }
      quantity = this.billableNights(admission.admissionDate, admission.dischargeDate);
      unitPrice = new Prisma.Decimal(dailyRate);
      const bedLabel = admission.bed ? ` - Bed ${admission.bed.bedNumber}` : '';
      description = `Inpatient admission ${admission.id}${bedLabel} (${quantity} night${quantity === 1 ? '' : 's'})`;
    } else if (sourceType) {
      await this.assertUniqueSource(tx, sourceType, sourceId);
    }

    return {
      description,
      quantity,
      unitPrice,
      total: unitPrice.mul(quantity),
      sourceType,
      sourceId,
    };
  }

  private async assertUniqueSource(tx: Tx, sourceType: string, sourceId: number | null) {
    const duplicate = await tx.invoiceItem.findFirst({
      where: { sourceType, sourceId },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(`This ${sourceType} charge has already been invoiced`);
    }
  }

  async findInvoices(filters: { patientId?: number; from?: Date; to?: Date; outstandingOnly?: boolean }) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        ...(filters.patientId !== undefined ? { patientId: filters.patientId } : {}),
        ...(filters.from || filters.to ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        } : {}),
      },
      include: {
        patient: true,
        items: true,
        payments: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const result = invoices.map((invoice) => ({
      ...invoice,
      balance: invoice.totalAmount.sub(invoice.paidAmount),
      paymentStatus: this.paymentStatus(invoice.totalAmount, invoice.paidAmount),
    }));
    return filters.outstandingOnly
      ? result.filter((invoice) => invoice.balance.greaterThan(0))
      : result;
  }

  async findInvoice(id: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        patient: true,
        items: { orderBy: { id: 'asc' } },
        payments: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return {
      ...invoice,
      balance: invoice.totalAmount.sub(invoice.paidAmount),
      paymentStatus: this.paymentStatus(invoice.totalAmount, invoice.paidAmount),
    };
  }

  async updateInvoice(invoiceId: number, dto: CreateInvoiceDto, userId: number) {
    if (!dto.items?.length) throw new BadRequestException('At least one invoice item is required');
    return this.prisma.$transaction(async tx => {
      const current = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { items: true } });
      if (!current) throw new NotFoundException('Invoice not found');
      if (!['DRAFT', 'REJECTED'].includes(current.verificationStatus)) throw new BadRequestException('Only draft or rejected invoices can be edited');
      if (!current.paidAmount.equals(0)) throw new BadRequestException('An invoice with payments cannot be edited');
      if (dto.patientId !== current.patientId) throw new BadRequestException('Invoice patient cannot be changed');
      await tx.invoiceItem.deleteMany({ where: { invoiceId } });
      const items = [];
      for (const item of dto.items) items.push(await this.resolvePricedItem(tx, dto.patientId, { description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, sourceType: item.sourceType?.trim() || null, sourceId: item.sourceId ?? null }));
      const subtotal = items.reduce((sum, item) => sum.add(item.total), new Prisma.Decimal(0));
      const discount = new Prisma.Decimal(dto.discountAmount ?? current.discountAmount);
      const tax = new Prisma.Decimal(dto.taxAmount ?? current.taxAmount);
      if (discount.greaterThan(subtotal)) throw new BadRequestException('Discount cannot exceed invoice item total');
      const total = subtotal.sub(discount).add(tax);
      const updated = await tx.invoice.update({ where: { id: invoiceId }, data: { totalAmount: total, discountAmount: discount, taxAmount: tax, dueDate: dto.dueDate ? new Date(dto.dueDate) : current.dueDate, notes: dto.notes ?? current.notes, verificationStatus: 'DRAFT', submittedAt: null, rejectionReason: null, rejectedAt: null, rejectedById: null, items: { create: items } }, include: { patient: true, items: true, payments: true } });
      await tx.auditLog.create({ data: { action: 'UPDATE_DRAFT', entity: 'Invoice', entityId: String(invoiceId), userId, oldData: { totalAmount: current.totalAmount.toString(), verificationStatus: current.verificationStatus }, newData: { totalAmount: total.toString(), verificationStatus: 'DRAFT' } } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async submitInvoice(invoiceId: number, userId: number) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (!['DRAFT', 'REJECTED'].includes(invoice.verificationStatus)) {
      throw new BadRequestException('Only draft or rejected invoices can be submitted');
    }
    const updated = await this.prisma.$transaction(async tx => {
      const row = await tx.invoice.update({ where: { id: invoiceId }, data: {
        verificationStatus: 'PENDING_REVIEW', submittedAt: new Date(),
        rejectionReason: null, rejectedAt: null, rejectedById: null,
      }, include: { patient: true, items: true } });
      await tx.auditLog.create({ data: { action: 'SUBMIT_FOR_VERIFICATION', entity: 'Invoice', entityId: String(invoiceId), userId, oldData: { verificationStatus: invoice.verificationStatus }, newData: { verificationStatus: row.verificationStatus } } });
      return row;
    });
    return updated;
  }

  pendingVerification() {
    return this.prisma.invoice.findMany({ where: { verificationStatus: 'PENDING_REVIEW' }, include: { patient: true, items: true, payments: true }, orderBy: { submittedAt: 'asc' } });
  }

  async verifyInvoice(invoiceId: number, userId: number) {
    return this.prisma.$transaction(async tx => {
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.verificationStatus !== 'PENDING_REVIEW') throw new BadRequestException('Only pending invoices can be verified');
      const updated = await tx.invoice.update({ where: { id: invoiceId }, data: { verificationStatus: 'VERIFIED', verifiedAt: new Date(), verifiedById: userId, rejectionReason: null, rejectedAt: null, rejectedById: null }, include: { patient: true, items: true } });
      await tx.auditLog.create({ data: { action: 'VERIFY', entity: 'Invoice', entityId: String(invoiceId), userId, oldData: { verificationStatus: invoice.verificationStatus }, newData: { verificationStatus: updated.verificationStatus } } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async rejectInvoice(invoiceId: number, reason: string, userId: number) {
    const cleanReason = reason.trim();
    if (cleanReason.length < 3) throw new BadRequestException('A rejection reason is required');
    return this.prisma.$transaction(async tx => {
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.verificationStatus !== 'PENDING_REVIEW') throw new BadRequestException('Only pending invoices can be rejected');
      const updated = await tx.invoice.update({ where: { id: invoiceId }, data: { verificationStatus: 'REJECTED', rejectionReason: cleanReason, rejectedAt: new Date(), rejectedById: userId }, include: { patient: true, items: true } });
      await tx.auditLog.create({ data: { action: 'REJECT', entity: 'Invoice', entityId: String(invoiceId), userId, oldData: { verificationStatus: invoice.verificationStatus }, newData: { verificationStatus: updated.verificationStatus, rejectionReason: cleanReason } } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async recordPayment(invoiceId: number, dto: CreatePaymentDto, userId: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
        if (!invoice) throw new NotFoundException('Invoice not found');

        if (invoice.verificationStatus !== 'VERIFIED') throw new BadRequestException('Only verified invoices can receive payments');

        const amount = new Prisma.Decimal(dto.amount);
        const balance = invoice.totalAmount.sub(invoice.paidAmount);
        if (balance.lessThanOrEqualTo(0)) {
          throw new BadRequestException('Invoice is already fully paid');
        }
        if (amount.greaterThan(balance)) {
          throw new BadRequestException(`Payment exceeds outstanding balance of ${balance.toString()}`);
        }

        const payment = await tx.payment.create({
          data: {
            amount,
            method: dto.method,
            reference: dto.reference?.trim() || null,
            invoiceId,
          },
        });
        const updated = await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            paidAmount: { increment: amount },
            status: amount.greaterThanOrEqualTo(balance)
              ? 'PAID'
              : 'PARTIALLY_PAID',
          },
          include: { patient: true, items: true, payments: true },
        });
        await tx.auditLog.create({
          data: {
            action: 'PAYMENT_RECEIVED',
            entity: 'Invoice',
            entityId: String(invoiceId),
            userId,
            newData: {
              paymentId: payment.id,
              amount: amount.toString(),
              method: dto.method,
              paidAmount: updated.paidAmount.toString(),
              balance: updated.totalAmount.sub(updated.paidAmount).toString(),
            },
          },
        });
        return {
          payment,
          invoice: {
            ...updated,
            balance: updated.totalAmount.sub(updated.paidAmount),
            paymentStatus: this.paymentStatus(updated.totalAmount, updated.paidAmount),
          },
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2034') {
        throw new ConflictException('Concurrent payment detected; refresh the invoice and retry');
      }
      throw error;
    }
  }

  async recordRefund(invoiceId: number, paymentId: number, dto: CreateRefundDto, userId: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({ where: { id: paymentId } });
        if (!payment || payment.invoiceId !== invoiceId) {
          throw new NotFoundException('Payment not found for this invoice');
        }
        const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
        if (!invoice) throw new NotFoundException('Invoice not found');

        const amount = new Prisma.Decimal(dto.amount);
        const alreadyRefunded = payment.refundedAmount ?? new Prisma.Decimal(0);
        const refundable = payment.amount.sub(alreadyRefunded);
        if (amount.greaterThan(refundable)) {
          throw new BadRequestException(`Refund exceeds remaining payment amount of ${refundable.toString()}`);
        }
        if (amount.greaterThan(invoice.paidAmount)) {
          throw new BadRequestException('Refund exceeds invoice paid amount');
        }

        const updatedPayment = await tx.payment.update({
          where: { id: paymentId },
          data: {
            refundedAmount: { increment: amount },
            status: amount.greaterThanOrEqualTo(refundable) ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
            notes: dto.reason?.trim() || payment.notes,
          },
        });
        const remainingPaid = invoice.paidAmount.sub(amount);
        const updatedInvoice = await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            paidAmount: remainingPaid,
            status: remainingPaid.equals(0)
              ? 'REFUNDED'
              : remainingPaid.lessThan(invoice.totalAmount)
                ? 'PARTIALLY_PAID'
                : 'PAID',
          },
          include: { patient: true, items: true, payments: true },
        });
        await tx.auditLog.create({
          data: {
            action: 'PAYMENT_REFUNDED',
            entity: 'Payment',
            entityId: String(paymentId),
            userId,
            newData: {
              invoiceId,
              amount: amount.toString(),
              reason: dto.reason?.trim() || null,
            },
          },
        });
        return {
          payment: updatedPayment,
          invoice: {
            ...updatedInvoice,
            balance: updatedInvoice.totalAmount.sub(updatedInvoice.paidAmount),
            paymentStatus: this.paymentStatus(updatedInvoice.totalAmount, updatedInvoice.paidAmount),
          },
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2034') {
        throw new ConflictException('Concurrent refund detected; refresh and retry');
      }
      throw error;
    }
  }

  async paymentHistory(invoiceId: number) {
    await this.findInvoice(invoiceId);
    return this.prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async statistics(from?: Date, to?: Date) {
    const where = from || to ? {
      createdAt: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      },
    } : {};
    const invoices = await this.prisma.invoice.findMany({
      where,
      select: { totalAmount: true, paidAmount: true, createdAt: true },
    });
    const totalInvoiced = invoices.reduce((s, x) => s.add(x.totalAmount), new Prisma.Decimal(0));
    const totalCollected = invoices.reduce((s, x) => s.add(x.paidAmount), new Prisma.Decimal(0));
    const totalOutstanding = totalInvoiced.sub(totalCollected);
    const fullyPaid = invoices.filter(x => x.paidAmount.greaterThanOrEqualTo(x.totalAmount)).length;
    const unpaid = invoices.filter(x => x.paidAmount.equals(0)).length;
    const partiallyPaid = invoices.length - fullyPaid - unpaid;
    return {
      invoiceCount: invoices.length,
      totalInvoiced: totalInvoiced.toString(),
      totalCollected: totalCollected.toString(),
      totalOutstanding: totalOutstanding.toString(),
      fullyPaidInvoices: fullyPaid,
      partiallyPaidInvoices: partiallyPaid,
      unpaidInvoices: unpaid,
    };
  }

  async revenueByMethod(from?: Date, to?: Date) {
    const payments = await this.prisma.payment.findMany({
      where: {
        ...(from || to ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        } : {}),
      },
      select: { amount: true, refundedAmount: true, method: true },
    });
    const totals = new Map<string, Prisma.Decimal>();
    for (const payment of payments) {
      const collected = payment.amount.sub(payment.refundedAmount ?? 0);
      totals.set(payment.method, (totals.get(payment.method) ?? new Prisma.Decimal(0)).add(collected));
    }
    return [...totals.entries()].map(([method, amount]) => ({
      method, amount: amount.toString(),
    }));
  }

  async revenueByCategory(from?: Date, to?: Date) {
    const items = await this.prisma.invoiceItem.findMany({
      where: {
        invoice: {
          ...(from || to ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          } : {}),
        },
      },
      select: { sourceType: true, total: true },
    });
    const totals = new Map<string, Prisma.Decimal>();
    for (const item of items) {
      const key = item.sourceType || 'MANUAL';
      totals.set(key, (totals.get(key) ?? new Prisma.Decimal(0)).add(item.total));
    }
    return [...totals.entries()].map(([category, amount]) => ({
      category, invoiced: amount.toString(),
    }));
  }

  async chargePreview(patientId: number) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } });
    if (!patient) throw new NotFoundException('Patient not found');
    const [appointments, prescriptions, labRequests, admissions] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { patientId, status: 'COMPLETED' },
        include: { doctor: true, department: true },
        orderBy: { scheduledAt: 'desc' },
      }),
      this.prisma.prescription.findMany({
        where: { patientId, dispensedAt: { not: null }, verificationStatus: 'VERIFIED' },
        include: { items: { include: { medicine: true } } },
        orderBy: { dispensedAt: 'desc' },
      }),
      this.prisma.labRequest.findMany({
        where: { patientId, status: { in: ['COMPLETED', 'VERIFIED'] } },
        include: { items: { include: { labTest: true, result: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.admission.findMany({
        where: { patientId, status: { in: ['ADMITTED', 'DISCHARGED'] } },
        include: { bed: { include: { room: { include: { ward: true } } } } },
      }),
    ]);
    const existingSources = await this.prisma.invoiceItem.findMany({
      where: { sourceType: { not: null }, sourceId: { not: null } },
      select: { sourceType: true, sourceId: true, quantity: true },
    });
    const charged = new Set(
      existingSources
        .filter((item) => item.sourceType !== 'PRESCRIPTION_ITEM')
        .map((item) => `${item.sourceType}:${item.sourceId}`),
    );

    const invoicedPrescriptionQuantities = new Map<number, number>();
    for (const item of existingSources) {
      if (item.sourceType === 'PRESCRIPTION_ITEM' && item.sourceId !== null) {
        invoicedPrescriptionQuantities.set(
          item.sourceId,
          (invoicedPrescriptionQuantities.get(item.sourceId) ?? 0) + item.quantity,
        );
      }
    }

    const consultation = appointments
      .filter((appointment) => !charged.has(`APPOINTMENT:${appointment.id}`))
      .map((appointment) => ({
        sourceType: 'APPOINTMENT',
        sourceId: appointment.id,
        description: `Consultation fee - ${appointment.appointmentNo}`,
        quantity: 1,
        unitPrice: appointment.consultationFee.toString(),
      }));

    const pharmacy = prescriptions.flatMap((prescription) =>
      prescription.items.flatMap((item) => {
        const remainingQuantity = (item.dispensedQuantity ?? 0)
          - (invoicedPrescriptionQuantities.get(item.id) ?? 0);
        if (remainingQuantity <= 0 || !item.medicine?.active) return [];
        return [{
          sourceType: 'PRESCRIPTION_ITEM',
          sourceId: item.id,
          description: `Medicine - ${item.medicineName}`,
          quantity: remainingQuantity,
          unitPrice: item.medicine.sellingPrice.toString(),
        }];
      }),
    );

    const laboratory = labRequests.flatMap((request) =>
      request.items
        .filter((item) => item.result?.verifiedAt && !charged.has(`LAB_REQUEST_ITEM:${item.id}`))
        .map((item) => ({
          sourceType: 'LAB_REQUEST_ITEM',
          sourceId: item.id,
          description: `Laboratory test - ${item.labTest.name}`,
          quantity: 1,
          unitPrice: item.labTest.price.toString(),
        })),
    );

    const inpatient = admissions.flatMap((admission) => {
      if (charged.has(`ADMISSION:${admission.id}`)) return [];
      const dailyRate = admission.bed?.room?.dailyRate;
      if (!dailyRate || new Prisma.Decimal(dailyRate).lessThanOrEqualTo(0)) return [];
      const nights = this.billableNights(admission.admissionDate, admission.dischargeDate);
      return [{
        sourceType: 'ADMISSION',
        sourceId: admission.id,
        description: `Inpatient admission ${admission.id}${admission.bed ? ` - Bed ${admission.bed.bedNumber}` : ''} (${nights} night${nights === 1 ? '' : 's'})`,
        quantity: nights,
        unitPrice: dailyRate.toString(),
      }];
    });

    return { patientId, consultation, pharmacy, laboratory, inpatient };
  }

  async dailyCollections(date?: string) {
    const target = date ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) throw new BadRequestException('Date must use YYYY-MM-DD');
    const [year, month, day] = target.split('-').map(Number);
    const start = new Date(year, month - 1, day);
    const end = new Date(year, month - 1, day + 1);
    if (start.getFullYear() !== year || start.getMonth() !== month - 1 || start.getDate() !== day) {
      throw new BadRequestException('Invalid collection date');
    }
    const payments = await this.prisma.payment.findMany({
      where: { createdAt: { gte: start, lt: end } },
      include: { invoice: { include: { patient: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const byMethod = new Map<string, Prisma.Decimal>();
    for (const payment of payments) {
      const collected = payment.amount.sub(payment.refundedAmount ?? 0);
      byMethod.set(payment.method, (byMethod.get(payment.method) ?? new Prisma.Decimal(0)).add(collected));
    }
    return {
      date: target,
      paymentCount: payments.length,
      totalCollected: payments.reduce(
        (sum, payment) => sum.add(payment.amount.sub(payment.refundedAmount ?? 0)),
        new Prisma.Decimal(0),
      ).toString(),
      byMethod: [...byMethod.entries()].map(([method, amount]) => ({ method, amount: amount.toString() })),
      payments,
    };
  }

  private paymentStatus(total: Prisma.Decimal, paid: Prisma.Decimal) {
    if (paid.lessThanOrEqualTo(0) && total.greaterThan(0)) return 'UNPAID';
    if (paid.greaterThanOrEqualTo(total)) return 'PAID';
    if (paid.greaterThan(0)) return 'PARTIALLY_PAID';
    return 'UNPAID';
  }
}

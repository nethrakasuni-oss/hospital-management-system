import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateInvoiceDto } from '../dto/create-invoice.dto.js';
import { CreatePaymentDto } from '../dto/create-payment.dto.js';

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

  async createInvoice(dto: CreateInvoiceDto, userId: number) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: dto.patientId }, select: { id: true },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    if (!dto.items?.length) throw new BadRequestException('At least one invoice item is required');

    const items = dto.items.map((item) => {
      const total = new Prisma.Decimal(item.unitPrice).mul(item.quantity);
      return {
        description: item.description.trim(),
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(item.unitPrice),
        total,
      };
    });
    const totalAmount = items.reduce(
      (sum, item) => sum.add(item.total),
      new Prisma.Decimal(0),
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.create({
          data: {
            invoiceNumber: this.invoiceNumber(),
            totalAmount,
            paidAmount: new Prisma.Decimal(0),
            patientId: dto.patientId,
            items: { create: items },
          },
          include: { patient: true, items: true, payments: true },
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
              itemCount: invoice.items.length,
            },
          },
        });
        return invoice;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException('Invoice number already exists; please retry');
      }
      if ((error as { code?: string })?.code === 'P2034') {
        throw new ConflictException('Invoice creation conflicted with another transaction; please retry');
      }
      throw error;
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

  async recordPayment(invoiceId: number, dto: CreatePaymentDto, userId: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
        if (!invoice) throw new NotFoundException('Invoice not found');

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
          data: { paidAmount: { increment: amount } },
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
      select: { amount: true, method: true },
    });
    const totals = new Map<string, Prisma.Decimal>();
    for (const payment of payments) {
      totals.set(payment.method, (totals.get(payment.method) ?? new Prisma.Decimal(0)).add(payment.amount));
    }
    return [...totals.entries()].map(([method, amount]) => ({
      method, amount: amount.toString(),
    }));
  }

  private paymentStatus(total: Prisma.Decimal, paid: Prisma.Decimal) {
    if (paid.greaterThanOrEqualTo(total)) return 'PAID';
    if (paid.greaterThan(0)) return 'PARTIALLY_PAID';
    return 'UNPAID';
  }
}

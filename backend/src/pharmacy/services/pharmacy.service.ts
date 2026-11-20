import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateMedicineCategoryDto } from '../dto/create-medicine-category.dto.js';
import { CreateMedicineDto } from '../dto/create-medicine.dto.js';
import { UpdateMedicineDto } from '../dto/update-medicine.dto.js';
import { CreateStockBatchDto } from '../dto/create-stock-batch.dto.js';
import { AdjustStockDto } from '../dto/adjust-stock.dto.js';
import { CreatePrescriptionDto } from '../dto/create-prescription.dto.js';
import { VerifyPrescriptionDto } from '../dto/verify-prescription.dto.js';
import { DispensePrescriptionDto } from '../dto/dispense-prescription.dto.js';
import { CorrectPrescriptionItemDto } from '../dto/correct-prescription-item.dto.js';

@Injectable()
export class PharmacyService {
  constructor(private readonly prisma: PrismaService) {}

  async createCategory(dto: CreateMedicineCategoryDto) {
    try {
      return await this.prisma.medicineCategory.create({
        data: { name: dto.name.trim(), description: dto.description?.trim() || null },
      });
    } catch (e) {
      if ((e as {code?: string}).code === 'P2002') throw new ConflictException('Medicine category already exists');
      throw e;
    }
  }
  findCategories() {
    return this.prisma.medicineCategory.findMany({
      include: { _count: { select: { medicines: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createMedicine(dto: CreateMedicineDto) {
    if (dto.categoryId !== undefined) {
      const category = await this.prisma.medicineCategory.findUnique({ where: { id: dto.categoryId } });
      if (!category) throw new NotFoundException('Medicine category not found');
    }
    try {
      return await this.prisma.medicine.create({
        data: {
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          genericName: dto.genericName?.trim() || null,
          manufacturer: dto.manufacturer?.trim() || null,
          unit: dto.unit.trim(),
          sellingPrice: new Prisma.Decimal(dto.sellingPrice),
          ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        },
        include: { category: true },
      });
    } catch (e) {
      if ((e as {code?: string}).code === 'P2002') throw new ConflictException('Medicine code already exists');
      throw e;
    }
  }

  async findMedicines(search?: string, categoryId?: number, includeInactive = false) {
    const q = search?.trim();
    const rows = await this.prisma.medicine.findMany({
      where: {
        ...(includeInactive ? {} : { active: true }),
        ...(categoryId !== undefined ? { categoryId } : {}),
        ...(q ? { OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { genericName: { contains: q, mode: 'insensitive' } },
          { manufacturer: { contains: q, mode: 'insensitive' } },
        ] } : {}),
      },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
    const stock = await this.prisma.medicineBatch.groupBy({
      by: ['medicineId'],
      _sum: { quantity: true },
    });
    const stockMap = new Map(stock.map(x => [x.medicineId, x._sum.quantity ?? 0]));
    return rows.map(m => ({ ...m, currentStock: stockMap.get(m.id) ?? 0 }));
  }

  async findMedicine(id: number) {
    const medicine = await this.prisma.medicine.findUnique({
      where: { id },
      include: {
        category: true,
        batches: { orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }] },
      },
    });
    if (!medicine) throw new NotFoundException('Medicine not found');
    const currentStock = medicine.batches.reduce((sum, b) => sum + b.quantity, 0);
    return { ...medicine, currentStock };
  }

  async updateMedicine(id: number, dto: UpdateMedicineDto) {
    await this.findMedicine(id);
    if (dto.categoryId !== undefined && dto.categoryId !== null) {
      const category = await this.prisma.medicineCategory.findUnique({ where: { id: dto.categoryId } });
      if (!category) throw new NotFoundException('Medicine category not found');
    }
    return this.prisma.medicine.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.genericName !== undefined ? { genericName: dto.genericName?.trim() || null } : {}),
        ...(dto.manufacturer !== undefined ? { manufacturer: dto.manufacturer?.trim() || null } : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit.trim() } : {}),
        ...(dto.sellingPrice !== undefined ? { sellingPrice: new Prisma.Decimal(dto.sellingPrice) } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
      include: { category: true },
    });
  }

  async createBatch(dto: CreateStockBatchDto, userId: number) {
    const medicine = await this.prisma.medicine.findUnique({ where: { id: dto.medicineId } });
    if (!medicine) throw new NotFoundException('Medicine not found');
    if (!medicine.active) throw new BadRequestException('Cannot add stock to an inactive medicine');
    const expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : null;
    if (expiryDate && (Number.isNaN(expiryDate.getTime()) || expiryDate <= new Date())) {
      throw new BadRequestException('Expiry date must be a valid future date');
    }
    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
      if (!supplier || !supplier.isActive) throw new BadRequestException('Supplier does not exist or is inactive');
    }
    try {
      return await this.prisma.$transaction(async tx => {
        const batch = await tx.medicineBatch.create({
          data: {
            medicineId: dto.medicineId,
            batchNumber: dto.batchNumber.trim(),
            quantity: dto.quantity,
            costPrice: new Prisma.Decimal(dto.costPrice),
            expiryDate,
            ...(dto.supplierId ? { supplierId: dto.supplierId } : {}),
          },
        });
        await tx.inventoryTransaction.create({
          data: {
            type: 'PURCHASE',
            quantity: dto.quantity,
            medicineId: dto.medicineId,
            batchId: batch.id,
            performedById: userId,
            notes: `Initial stock received: batch ${batch.batchNumber}`,
          },
        });
        return batch;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (e) {
      if ((e as {code?: string}).code === 'P2002') throw new ConflictException('This batch number already exists for the medicine');
      if ((e as {code?: string}).code === 'P2034') throw new ConflictException('Concurrent stock update; please retry');
      throw e;
    }
  }

  async adjustStock(dto: AdjustStockDto, userId: number) {
    return this.prisma.$transaction(async tx => {
      const medicine = await tx.medicine.findUnique({ where: { id: dto.medicineId } });
      if (!medicine) throw new NotFoundException('Medicine not found');
      let batchId = dto.batchId;
      if (batchId) {
        const batch = await tx.medicineBatch.findUnique({ where: { id: batchId } });
        if (!batch || batch.medicineId !== dto.medicineId) throw new BadRequestException('Batch does not belong to the selected medicine');
        if (dto.type !== 'RETURN' && batch.quantity < dto.quantity) {
          throw new BadRequestException('Adjustment quantity exceeds available batch stock');
        }
        await tx.medicineBatch.update({
          where: { id: batchId },
          data: { quantity: { increment: dto.type === 'RETURN' ? dto.quantity : -dto.quantity } },
        });
      } else if (dto.type === 'ADJUSTMENT' || dto.type === 'EXPIRED') {
        throw new BadRequestException('Select a batch for stock reduction or expiry adjustment');
      }
      return tx.inventoryTransaction.create({
        data: {
          type: dto.type,
          quantity: dto.quantity,
          medicineId: dto.medicineId,
          ...(batchId ? { batchId } : {}),
          performedById: userId,
          notes: dto.notes.trim(),
        },
        include: { medicine: true, batch: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch(e => {
      if ((e as {code?:string}).code === 'P2034') throw new ConflictException('Concurrent stock update; please retry');
      throw e;
    });
  }

  async stockOverview(lowStockThreshold = 10, expiryWithinDays = 90) {
    if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0) throw new BadRequestException('lowStockThreshold must be zero or greater');
    if (!Number.isInteger(expiryWithinDays) || expiryWithinDays < 1 || expiryWithinDays > 365) throw new BadRequestException('expiryWithinDays must be between 1 and 365');
    const today = new Date();
    const expiryLimit = new Date(today);
    expiryLimit.setDate(expiryLimit.getDate() + expiryWithinDays);
    const [medicines, batches] = await Promise.all([
      this.prisma.medicine.findMany({ where: { active: true }, include: { category: true }, orderBy: { name: 'asc' } }),
      this.prisma.medicineBatch.findMany({
        where: { quantity: { gt: 0 }, expiryDate: { not: null, lte: expiryLimit } },
        include: { medicine: true, supplier: true },
        orderBy: { expiryDate: 'asc' },
      }),
    ]);
    const stock = await this.prisma.medicineBatch.groupBy({ by: ['medicineId'], _sum: { quantity: true } });
    const stockMap = new Map(stock.map(x => [x.medicineId, x._sum.quantity ?? 0]));
    const lowStock = medicines
      .map(m => ({ id: m.id, code: m.code, name: m.name, unit: m.unit, currentStock: stockMap.get(m.id) ?? 0 }))
      .filter(m => m.currentStock <= lowStockThreshold);
    const expired = batches.filter(b => b.expiryDate && b.expiryDate < today);
    const expiringSoon = batches.filter(b => b.expiryDate && b.expiryDate >= today);
    return { lowStockThreshold, expiryWithinDays, lowStock, expired, expiringSoon };
  }

  async transactions(medicineId?: number, type?: string) {
    return this.prisma.inventoryTransaction.findMany({
      where: {
        ...(medicineId !== undefined ? { medicineId } : {}),
        ...(type ? { type: type as any } : {}),
      },
      include: { medicine: true, batch: true, performedBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async dashboard() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const [medicines, batches, pendingPrescriptions, todaysSales] = await Promise.all([
      this.prisma.medicine.findMany({ where: { active: true }, include: { batches: true } }),
      this.prisma.medicineBatch.findMany({ include: { medicine: true, supplier: true } }),
      this.prisma.prescription.count({ where: { status: 'ACTIVE', verificationStatus: 'PENDING' } }),
      this.prisma.inventoryTransaction.findMany({
        where: { type: 'SALE', createdAt: { gte: start, lt: end } },
        include: { medicine: true, performedBy: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const stockByMedicine = new Map<number, number>();
    for (const batch of batches) {
      stockByMedicine.set(batch.medicineId, (stockByMedicine.get(batch.medicineId) ?? 0) + batch.quantity);
    }
    const stockValues = [...stockByMedicine.values()];
    return {
      totalMedicines: medicines.length,
      availableStock: stockValues.reduce((sum, quantity) => sum + quantity, 0),
      lowStockMedicines: medicines.filter(medicine => (stockByMedicine.get(medicine.id) ?? 0) <= 10).length,
      expiredMedicines: batches.filter(batch =>
        batch.expiryDate !== null && batch.expiryDate < now && batch.quantity > 0,
      ).length,
      pendingPrescriptions,
      todaysDispensing: {
        transactionCount: todaysSales.length,
        quantity: todaysSales.reduce((sum, transaction) => sum + transaction.quantity, 0),
      },
    };
  }

  private parseReportDate(value: string | undefined, fieldName: string, endOfDay = false) {
    if (!value) return undefined;
    const date = endOfDay ? new Date(`${value}T23:59:59.999`) : new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`Invalid ${fieldName} date`);
    return date;
  }

  async dailyDispensingReport(date?: string) {
    const target = date ?? new Date().toISOString().slice(0, 10);
    const start = this.parseReportDate(target, 'date');
    const end = new Date(start!.getTime());
    end.setDate(end.getDate() + 1);
    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: { type: 'SALE', createdAt: { gte: start, lt: end } },
      include: { medicine: true, batch: true, performedBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return { date: target, totalTransactions: transactions.length, totalQuantity: transactions.reduce((sum, row) => sum + row.quantity, 0), transactions };
  }

  async medicineUsageReport(from?: string, to?: string) {
    const start = this.parseReportDate(from, 'from');
    const end = this.parseReportDate(to, 'to', true);
    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: {
        type: 'SALE',
        ...(start || end ? { createdAt: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } } : {}),
      },
      include: { medicine: true },
    });
    const usage = new Map<number, { medicineId: number; name: string; code: string; quantity: number }>();
    for (const transaction of transactions) {
      const current = usage.get(transaction.medicineId) ?? {
        medicineId: transaction.medicineId,
        name: transaction.medicine.name,
        code: transaction.medicine.code,
        quantity: 0,
      };
      current.quantity += transaction.quantity;
      usage.set(transaction.medicineId, current);
    }
    return [...usage.values()].sort((a, b) => b.quantity - a.quantity);
  }

  async stockMovementReport(medicineId?: number, from?: string, to?: string) {
    const start = this.parseReportDate(from, 'from');
    const end = this.parseReportDate(to, 'to', true);
    return this.prisma.inventoryTransaction.findMany({
      where: {
        ...(medicineId !== undefined ? { medicineId } : {}),
        ...(start || end ? { createdAt: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } } : {}),
      },
      include: { medicine: true, batch: true, performedBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
  }

  async verifyPrescription(prescriptionId: number, dto: VerifyPrescriptionDto, userId: number) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: { items: { include: { medicine: true } } },
    });
    if (!prescription) throw new NotFoundException('Prescription not found');
    if (prescription.status === 'CANCELLED') throw new BadRequestException('Cancelled prescriptions cannot be verified');
    if (prescription.status === 'COMPLETED') throw new BadRequestException('Completed prescriptions cannot be verified');
    if (String(prescription.verificationStatus) === 'VERIFIED' || String(prescription.verificationStatus) === 'REJECTED') {
      throw new ConflictException('This prescription has already been reviewed');
    }

    if (dto.action === 'REJECT') {
      if (!dto.reason?.trim()) throw new BadRequestException('A rejection reason is required');
      return this.prisma.prescription.update({
        where: { id: prescriptionId },
        data: {
          verificationStatus: 'REJECTED',
          verificationReason: dto.reason.trim(),
          verifiedAt: new Date(),
          verifiedById: userId,
        },
        include: { patient: true, doctor: true, items: { include: { medicine: true } } },
      });
    }

    const now = new Date();
    for (const item of prescription.items) {
      if (!item.medicineId) throw new BadRequestException(`Medicine is not linked for prescription item ${item.id}`);
      if (!item.medicine || !item.medicine.active) throw new BadRequestException(`Medicine is unavailable for prescription item ${item.id}`);
      if (!item.quantity || item.quantity < 1) throw new BadRequestException(`A valid quantity is required for prescription item ${item.id}`);
      const batches = await this.prisma.medicineBatch.findMany({
        where: {
          medicineId: item.medicineId,
          quantity: { gt: 0 },
          OR: [{ expiryDate: null }, { expiryDate: { gt: now } }],
        },
        select: { quantity: true },
      });
      const available = batches.reduce((sum, batch) => sum + batch.quantity, 0);
      if (available < item.quantity) {
        throw new BadRequestException(`Insufficient available stock for ${item.medicineName}. Available: ${available}, required: ${item.quantity}`);
      }
    }

    return this.prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        verificationStatus: 'VERIFIED',
        verificationReason: dto.reason?.trim() || null,
        verifiedAt: new Date(),
        verifiedById: userId,
      },
      include: { patient: true, doctor: true, items: { include: { medicine: true } } },
    });
  }

  async dispensePrescription(prescriptionId: number, userId: number, dto: DispensePrescriptionDto = {}) {
    return this.prisma.$transaction(async tx => {
      const prescription = await tx.prescription.findUnique({
        where: { id: prescriptionId },
        include: { items: true },
      });
      if (!prescription) throw new NotFoundException('Prescription not found');
      if (!['ACTIVE', 'PARTIALLY_DISPENSED'].includes(prescription.status)) {
        throw new BadRequestException('Only active or partially dispensed prescriptions can be dispensed');
      }
      if (prescription.verificationStatus !== 'VERIFIED') {
        throw new BadRequestException('Prescription must be verified before dispensing');
      }
      if (prescription.items.length === 0) throw new BadRequestException('Prescription has no items');

      const requestedItems = dto.items;
      if (requestedItems) {
        const ids = requestedItems.map(item => item.itemId);
        if (new Set(ids).size !== ids.length) throw new BadRequestException('Duplicate prescription items are not allowed');
      }

      const dispensing: Array<{ medicineId: number; batchId: number; quantity: number }> = [];
      let allComplete = true;
      for (const item of prescription.items) {
        if (requestedItems && !requestedItems.some(request => request.itemId === item.id)) continue;
        if (!item.medicineId) throw new BadRequestException(`Medicine is not linked for prescription item ${item.id}`);
        if (!item.quantity || item.quantity < 1) throw new BadRequestException(`A valid quantity is required for prescription item ${item.id}`);
        const alreadyDispensed = item.dispensedQuantity ?? 0;
        if (alreadyDispensed >= item.quantity) continue;
        const requested = requestedItems?.find(request => request.itemId === item.id);
        const requestedQuantity = requested?.quantity ?? (item.quantity - alreadyDispensed);
        if (requestedQuantity > item.quantity - alreadyDispensed) {
          throw new BadRequestException(`Dispense quantity exceeds remaining quantity for prescription item ${item.id}`);
        }
        const medicine = await tx.medicine.findUnique({ where: { id: item.medicineId } });
        if (!medicine || !medicine.active) throw new BadRequestException(`Medicine for prescription item ${item.id} is unavailable`);
        let remaining = requestedQuantity;
        const batches = await tx.medicineBatch.findMany({
          where: {
            medicineId: medicine.id,
            quantity: { gt: 0 },
            OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }],
          },
          orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
        });
        const total = batches.reduce((sum, b) => sum + b.quantity, 0);
        if (total < remaining) throw new BadRequestException(`Insufficient stock for ${medicine.name}. Available: ${total}, required: ${remaining}`);
        for (const batch of batches) {
          if (remaining === 0) break;
          const take = Math.min(batch.quantity, remaining);
          await tx.medicineBatch.update({
            where: { id: batch.id },
            data: { quantity: { decrement: take } },
          });
          await tx.inventoryTransaction.create({
            data: {
              type: 'SALE',
              quantity: take,
              medicineId: medicine.id,
              batchId: batch.id,
              performedById: userId,
              notes: `Dispensed for prescription #${prescription.id}`,
            },
          });
          dispensing.push({ medicineId: medicine.id, batchId: batch.id, quantity: take });
          remaining -= take;
        }
        await tx.prescriptionItem.update({
          where: { id: item.id },
          data: { dispensedQuantity: alreadyDispensed + requestedQuantity },
        });
        if (alreadyDispensed + requestedQuantity < item.quantity) allComplete = false;
      }
      if (requestedItems) {
        const unknownIds = requestedItems
          .map(request => request.itemId)
          .filter(itemId => !prescription.items.some(item => item.id === itemId));
        if (unknownIds.length) throw new BadRequestException(`Prescription item ${unknownIds[0]} is not part of this prescription`);
      }
      const remainingForOtherItems = await tx.prescriptionItem.findMany({
        where: { prescriptionId },
        select: { quantity: true, dispensedQuantity: true },
      });
      allComplete = remainingForOtherItems.every(item =>
        (item.quantity ?? 0) <= (item.dispensedQuantity ?? 0),
      );
      const receiptNo = `RXD-${prescriptionId}-${Date.now()}`;
      const updated = await tx.prescription.update({
        where: { id: prescriptionId },
        data: {
          status: allComplete ? 'COMPLETED' : 'PARTIALLY_DISPENSED',
          dispensedAt: new Date(),
          dispensedById: userId,
        },
        include: { patient: true, doctor: true, items: { include: { medicine: true } } },
      });
      return {
        prescription: updated,
        dispensing,
        receipt: {
          receiptNo,
          prescriptionId,
          dispensedAt: updated.dispensedAt,
          dispensedById: userId,
          items: dispensing,
        },
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch(e => {
      if ((e as {code?:string}).code === 'P2034') throw new ConflictException('Concurrent dispensing operation; please retry');
      throw e;
    });
  }

  async findUnlinkedPrescriptionItems() {
    return this.prisma.prescriptionItem.findMany({
      where: { medicineId: null },
      include: {
        prescription: {
          include: {
            patient: true,
            doctor: { include: { user: true } },
          },
        },
        medicine: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async correctPrescriptionItem(itemId: number, dto: CorrectPrescriptionItemDto) {
    const [item, medicine] = await Promise.all([
      this.prisma.prescriptionItem.findUnique({
        where: { id: itemId },
        include: { prescription: true, medicine: true },
      }),
      this.prisma.medicine.findUnique({ where: { id: dto.medicineId } }),
    ]);
    if (!item) throw new NotFoundException('Prescription item not found');
    if (!medicine) throw new NotFoundException('Medicine not found');
    if (!medicine.active) throw new BadRequestException('Cannot associate an inactive medicine');

    return this.prisma.prescriptionItem.update({
      where: { id: itemId },
      data: {
        medicineId: medicine.id,
        medicineName: medicine.name,
      },
      include: {
        medicine: true,
        prescription: { include: { patient: true, doctor: true } },
      },
    });
  }

  async createPrescription(dto: CreatePrescriptionDto, userId: number, role: string) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: dto.doctorId },
      select: { id: true, userId: true, active: true },
    });
    if (!doctor) throw new NotFoundException('Doctor not found');
    if (!doctor.active) throw new ForbiddenException('Doctor is inactive');
    if (role === 'DOCTOR' && doctor.userId !== userId) {
      throw new ForbiddenException('Doctors can only create prescriptions under their own profile');
    }

    const patient = await this.prisma.patient.findUnique({
      where: { id: dto.patientId },
      select: { id: true },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    if (role === 'DOCTOR') {
      const ownedAppointment = await this.prisma.appointment.findFirst({
        where: { patientId: dto.patientId, doctorId: dto.doctorId },
        select: { id: true },
      });
      if (!ownedAppointment) throw new ForbiddenException('You can only prescribe for your own patients');
    }

    let medicalRecordId: number | undefined;
    if (dto.medicalRecordId !== undefined) {
      const record = await this.prisma.medicalRecord.findUnique({
        where: { id: dto.medicalRecordId },
        select: { id: true, patientId: true, doctorId: true },
      });
      if (!record) throw new NotFoundException('Medical record not found');
      if (record.patientId !== dto.patientId || record.doctorId !== dto.doctorId) {
        throw new ForbiddenException('Prescription must match the patient and doctor of the medical record');
      }
      medicalRecordId = record.id;
    }

    for (const item of dto.items) {
      const medicine = await this.prisma.medicine.findUnique({
        where: { id: item.medicineId },
        select: { id: true, name: true, active: true },
      });
      if (!medicine) throw new NotFoundException(`Medicine ${item.medicineId} not found`);
      if (!medicine.active) throw new BadRequestException(`Medicine ${medicine.name} is inactive`);
    }

    return this.prisma.prescription.create({
      data: {
        patientId: dto.patientId,
        doctorId: dto.doctorId,
        ...(medicalRecordId !== undefined ? { medicalRecordId } : {}),
        notes: dto.notes?.trim() || null,
        items: {
          create: await Promise.all(dto.items.map(async item => {
            const medicine = await this.prisma.medicine.findUnique({
              where: { id: item.medicineId },
              select: { id: true, name: true, active: true },
            });
            if (!medicine) throw new NotFoundException(`Medicine ${item.medicineId} not found`);
            if (!medicine.active) throw new BadRequestException(`Medicine ${medicine.name} is inactive`);
            return {
              medicineId: medicine.id,
              medicineName: medicine.name,
              dosage: item.dosage.trim(),
              frequency: item.frequency.trim(),
              duration: item.duration?.trim() || null,
              instructions: item.instructions?.trim() || null,
              quantity: item.quantity ?? null,
            };
          })),
        },
      },
      include: { patient: true, doctor: true, items: { include: { medicine: true } }, medicalRecord: true },
    });
  }

  async prescriptions(patientId: number | undefined, userId: number, role: string) {
    let doctorId: number | undefined;
    let nursePatientIds: number[] | undefined;
    if (role === 'DOCTOR') {
      const doctor = await this.prisma.doctor.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!doctor) throw new ForbiddenException('No doctor profile is linked to this account');
      doctorId = doctor.id;
    }
    if (role === 'NURSE') {
      const employee = await this.prisma.employee.findUnique({
        where: { userId },
        select: { id: true, isActive: true },
      });
      if (!employee) throw new ForbiddenException('Authenticated nurse is not linked to an employee record');
      if (!employee.isActive) throw new ForbiddenException('Nurse employee record is inactive');
      if (patientId !== undefined) {
        const assignment = await this.prisma.nursingAssignment.findFirst({
          where: { patientId, employeeId: employee.id, active: true },
          select: { id: true },
        });
        if (!assignment) throw new ForbiddenException(`You can only access prescriptions for patients assigned to you (patientId ${patientId})`);
      } else {
        const assignments = await this.prisma.nursingAssignment.findMany({
          where: { employeeId: employee.id, active: true },
          select: { patientId: true },
        });
        nursePatientIds = [...new Set(assignments.map(assignment => assignment.patientId))];
      }
    }
    return this.prisma.prescription.findMany({
      where: {
        ...(patientId !== undefined ? { patientId } : {}),
        ...(doctorId !== undefined ? { doctorId } : {}),
        ...(nursePatientIds !== undefined ? { patientId: { in: nursePatientIds } } : {}),
      },
      include: { patient: true, doctor: true, items: { include: { medicine: true } }, medicalRecord: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async prescription(id: number, userId: number, role: string) {
    const p = await this.prisma.prescription.findUnique({
      where: { id },
      include: { patient: true, doctor: true, items: { include: { medicine: true } } },
    });
    if (!p) throw new NotFoundException('Prescription not found');
    if (role === 'DOCTOR') {
      if (p.doctor.userId !== userId) {
        throw new ForbiddenException('You can only access prescriptions assigned to you');
      }
    }
    if (role === 'NURSE') {
      const employee = await this.prisma.employee.findUnique({
        where: { userId },
        select: { id: true, isActive: true },
      });
      if (!employee) throw new ForbiddenException('Authenticated nurse is not linked to an employee record');
      if (!employee.isActive) throw new ForbiddenException('Nurse employee record is inactive');
      const assignment = await this.prisma.nursingAssignment.findFirst({
        where: { patientId: p.patientId, employeeId: employee.id, active: true },
        select: { id: true },
      });
      if (!assignment) throw new ForbiddenException(`You can only access prescriptions for patients assigned to you (patientId ${p.patientId})`);
    }
    return p;
  }
}

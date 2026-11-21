import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreatePurchaseOrderDto } from '../dto/create-purchase-order.dto.js';
import { UpdatePurchaseOrderDto } from '../dto/update-purchase-order.dto.js';
import { ReceivePurchaseOrderDto } from '../dto/receive-purchase-order.dto.js';
@Injectable()
export class PurchaseOrderService {
  constructor(private readonly prisma: PrismaService) {}
  private number() { return `PO-${Date.now()}-${randomUUID().slice(0,8).toUpperCase()}`; }

  async create(userId: number, dto: CreatePurchaseOrderDto) {
    if (!dto.items?.length) throw new BadRequestException('At least one item is required');
    const supplier = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    if (!supplier.isActive) throw new BadRequestException('Supplier is inactive');
    const ids = [...new Set(dto.items.map(x => x.medicineId))];
    const medicines = await this.prisma.medicine.findMany({ where: { id: { in: ids }, active: true }, select: { id: true } });
    if (medicines.length !== ids.length) throw new BadRequestException('One or more medicines are missing or inactive');
    const expectedAt = dto.expectedAt ? new Date(dto.expectedAt) : null;
    if (expectedAt && Number.isNaN(expectedAt.getTime())) throw new BadRequestException('Invalid expectedAt');
    const total = dto.items.reduce((s,x) => s + x.quantityOrdered*x.unitCost, 0);
    return this.prisma.purchaseOrder.create({ data: {
      orderNumber: this.number(), supplierId: dto.supplierId, createdById: userId,
      expectedAt, notes: dto.notes?.trim() || null, totalAmount: new Prisma.Decimal(total),
      items: { create: dto.items.map(x => ({
        medicineId: x.medicineId, quantityOrdered: x.quantityOrdered,
        unitCost: new Prisma.Decimal(x.unitCost),
        lineTotal: new Prisma.Decimal(x.quantityOrdered*x.unitCost),
        description: x.description?.trim() || null,
      })) },
    }, include: { supplier: true, items: { include: { medicine: true } } } });
  }

  findAll(supplierId?: number, status?: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { ...(supplierId ? { supplierId } : {}), ...(status ? { status: status as never } : {}) },
      include: { supplier: true, items: { include: { medicine: true, receivedBatch: true } } },
      orderBy: { orderedAt: 'desc' },
    });
  }
  async findOne(id: number) {
    const row = await this.prisma.purchaseOrder.findUnique({
      where: { id }, include: { supplier: true, items: { include: { medicine: true, receivedBatch: true } } },
    });
    if (!row) throw new NotFoundException('Purchase order not found');
    return row;
  }
  async updateDraft(id: number, dto: UpdatePurchaseOrderDto) {
    const row = await this.findOne(id);
    if (String(row.status) !== 'DRAFT') throw new BadRequestException('Only draft orders can be edited');
    const expectedAt = dto.expectedAt === undefined ? undefined : dto.expectedAt === null ? null : new Date(dto.expectedAt);
    if (expectedAt && Number.isNaN(expectedAt.getTime())) throw new BadRequestException('Invalid expectedAt');
    return this.prisma.purchaseOrder.update({ where: { id }, data: {
      ...(dto.expectedAt !== undefined ? { expectedAt } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
    }, include: { supplier: true, items: true } });
  }
  async submit(id: number) {
  const row = await this.findOne(id);

  if (String(row.status) !== 'DRAFT' || !row.items.length) {
    throw new BadRequestException(
      'Only non-empty draft orders can be submitted',
    );
  }

  return this.prisma.purchaseOrder.update({
    where: { id },
    data: { status: 'SUBMITTED' },
    include: { supplier: true, items: true },
  });
}
  async cancel(id: number) {
    const row = await this.findOne(id);
    if (!['DRAFT','SUBMITTED'].includes(String(row.status)) || row.items.some(x => x.quantityReceived > 0))
      throw new BadRequestException('This purchase order cannot be cancelled');
    return this.prisma.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED' as never }, include: { supplier: true, items: true } });
  }
  async receive(id: number, userId: number, dto: ReceivePurchaseOrderDto) {
    if (!dto.items?.length) throw new BadRequestException('At least one received line is required');
    return this.prisma.$transaction(async tx => {
      const order = await tx.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
      if (!order) throw new NotFoundException('Purchase order not found');
      if (!['SUBMITTED','PARTIALLY_RECEIVED'].includes(String(order.status))) throw new BadRequestException('Order is not open for receiving');
      for (const line of dto.items) {
        const item = order.items.find(x => x.id === line.itemId);
        if (!item) throw new BadRequestException(`Item ${line.itemId} is not part of this order`);
        if (item.quantityReceived + line.quantityReceived > item.quantityOrdered) throw new BadRequestException('Received quantity exceeds ordered quantity');
        const expiryDate = line.expiryDate ? new Date(line.expiryDate) : null;
        if (expiryDate && (Number.isNaN(expiryDate.getTime()) || expiryDate < new Date(new Date().setHours(0,0,0,0))))
          throw new BadRequestException('Expiry date is invalid or already passed');
        const batch = await tx.medicineBatch.create({ data: {
          batchNumber: line.batchNumber.trim(), quantity: line.quantityReceived,
          costPrice: item.unitCost, expiryDate, medicineId: item.medicineId,
          supplierId: order.supplierId,
        }});
        await tx.purchaseOrderItem.update({ where: { id: item.id }, data: {
          quantityReceived: { increment: line.quantityReceived }, receivedBatchId: batch.id,
        }});
        await tx.inventoryTransaction.create({ data: {
          type: 'PURCHASE', quantity: line.quantityReceived,
          notes: dto.notes?.trim() || `Received against ${order.orderNumber}`,
          medicineId: item.medicineId, batchId: batch.id, performedById: userId,
        }});
      }
      const refreshed = await tx.purchaseOrder.findUniqueOrThrow({ where: { id }, include: { items: true } });
      const complete = refreshed.items.every(x => x.quantityReceived === x.quantityOrdered);
      const partial = refreshed.items.some(x => x.quantityReceived > 0);
      return tx.purchaseOrder.update({ where: { id }, data: {
        status: (complete ? 'RECEIVED' : partial ? 'PARTIALLY_RECEIVED' : 'SUBMITTED') as never,
        ...(complete ? { receivedAt: new Date() } : {}),
      }, include: { supplier: true, items: { include: { medicine: true, receivedBatch: true } } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch(e => {
      if ((e as {code?:string}).code === 'P2002') throw new ConflictException('Batch number already exists for this medicine');
      if ((e as {code?:string}).code === 'P2034') throw new ConflictException('Concurrent stock receipt; please retry');
      throw e;
    });
  }
}

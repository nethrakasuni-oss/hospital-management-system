import { Injectable } from '@nestjs/common';
import { SupplierService } from './services/supplier.service.js';
import { PurchaseOrderService } from './services/purchase-order.service.js';
import { CreateSupplierDto } from './dto/create-supplier.dto.js';
import { UpdateSupplierDto } from './dto/update-supplier.dto.js';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto.js';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto.js';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto.js';
@Injectable()
export class PharmacyProcurementService {
  constructor(private readonly suppliers: SupplierService, private readonly orders: PurchaseOrderService) {}
  createSupplier(d: CreateSupplierDto) { return this.suppliers.create(d); }
  findSuppliers(i: boolean) { return this.suppliers.findAll(i); }
  findSupplier(id: number) { return this.suppliers.findOne(id); }
  updateSupplier(id: number,d: UpdateSupplierDto) { return this.suppliers.update(id,d); }
  createOrder(u: number,d: CreatePurchaseOrderDto) { return this.orders.create(u,d); }
  findOrders(s?: number,st?: string) { return this.orders.findAll(s,st); }
  findOrder(id: number) { return this.orders.findOne(id); }
  updateOrder(id: number,d: UpdatePurchaseOrderDto) { return this.orders.updateDraft(id,d); }
  submitOrder(id: number) { return this.orders.submit(id); }
  cancelOrder(id: number) { return this.orders.cancel(id); }
  receiveOrder(id: number,u: number,d: ReceivePurchaseOrderDto) { return this.orders.receive(id,u,d); }
}

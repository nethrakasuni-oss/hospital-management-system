import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PharmacyProcurementController } from './pharmacy-procurement.controller.js';
import { PharmacyProcurementService } from './pharmacy-procurement.service.js';
import { SupplierService } from './services/supplier.service.js';
import { PurchaseOrderService } from './services/purchase-order.service.js';
@Module({
  imports: [PrismaModule],
  controllers: [PharmacyProcurementController],
  providers: [PharmacyProcurementService,SupplierService,PurchaseOrderService],
  exports: [PharmacyProcurementService],
})
export class PharmacyProcurementModule {}

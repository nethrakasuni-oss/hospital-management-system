import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PharmacyProcurementService } from './pharmacy-procurement.service.js';
import { CreateSupplierDto } from './dto/create-supplier.dto.js';
import { UpdateSupplierDto } from './dto/update-supplier.dto.js';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto.js';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto.js';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles/roles.guard.js';
import { Roles } from '../auth/roles/roles.decorator.js';
@Controller('pharmacy-procurement')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PharmacyProcurementController {
  constructor(private readonly service: PharmacyProcurementService) {}
  @Post('suppliers') @Roles('ADMIN','PHARMACIST')
  createSupplier(@Body() d: CreateSupplierDto) { return this.service.createSupplier(d); }
  @Get('suppliers') @Roles('ADMIN','PHARMACIST','ACCOUNTANT')
  findSuppliers(@Query('includeInactive') v?: string) {
    if (v !== undefined && !['true','false'].includes(v)) throw new BadRequestException('includeInactive must be true or false');
    return this.service.findSuppliers(v === 'true');
  }
  @Get('suppliers/:id') @Roles('ADMIN','PHARMACIST','ACCOUNTANT')
  findSupplier(@Param('id',ParseIntPipe) id: number) { return this.service.findSupplier(id); }
  @Patch('suppliers/:id') @Roles('ADMIN','PHARMACIST')
  updateSupplier(@Param('id',ParseIntPipe) id: number,@Body() d: UpdateSupplierDto) { return this.service.updateSupplier(id,d); }
  @Post('purchase-orders') @Roles('ADMIN','PHARMACIST')
  createOrder(@Body() d: CreatePurchaseOrderDto,@Req() r: any) { return this.service.createOrder(r.user.userId,d); }
  @Get('purchase-orders') @Roles('ADMIN','PHARMACIST','ACCOUNTANT')
  findOrders(@Query('supplierId') s?: string,@Query('status') st?: string) { return this.service.findOrders(s ? Number(s) : undefined,st); }
  @Get('purchase-orders/:id') @Roles('ADMIN','PHARMACIST','ACCOUNTANT')
  findOrder(@Param('id',ParseIntPipe) id: number) { return this.service.findOrder(id); }
  @Patch('purchase-orders/:id') @Roles('ADMIN','PHARMACIST')
  updateOrder(@Param('id',ParseIntPipe) id: number,@Body() d: UpdatePurchaseOrderDto) { return this.service.updateOrder(id,d); }
  @Patch('purchase-orders/:id/submit') @Roles('ADMIN','PHARMACIST')
  submitOrder(@Param('id',ParseIntPipe) id: number) { return this.service.submitOrder(id); }
  @Patch('purchase-orders/:id/cancel') @Roles('ADMIN','PHARMACIST')
  cancelOrder(@Param('id',ParseIntPipe) id: number) { return this.service.cancelOrder(id); }
  @Post('purchase-orders/:id/receive') @Roles('ADMIN','PHARMACIST')
  receiveOrder(@Param('id',ParseIntPipe) id: number,@Body() d: ReceivePurchaseOrderDto,@Req() r: any) { return this.service.receiveOrder(id,r.user.userId,d); }
}

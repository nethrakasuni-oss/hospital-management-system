import {
  BadRequestException, Body, Controller, Get, Param,Patch, ParseIntPipe,
  Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles/roles.guard.js';
import { Roles } from '../auth/roles/roles.decorator.js';
import { BillingService } from './services/billing.service.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { CreateRefundDto } from './dto/create-refund.dto.js';
import { RejectInvoiceDto } from './dto/reject-invoice.dto.js';
import { Permissions } from '../auth/permissions/permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions/permissions.guard.js';

@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  private parseDate(value?: string, endOfDay = false): Date | undefined {
    if (value === undefined) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid date filter');
    if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) date.setHours(23, 59, 59, 999);
    return date;
  }

  @Post('invoices')
  @Roles('ADMIN', 'RECEPTIONIST')
  @Permissions('INVOICE_CREATE')
  createInvoice(@Body() dto: CreateInvoiceDto, @Req() req: any) {
    return this.billing.createInvoice(dto, req.user.userId);
  }

  @Get('invoices')
  @Roles('ADMIN', 'RECEPTIONIST', 'ACCOUNTANT')
  @Permissions('INVOICE_VIEW')
  findInvoices(
    @Query('patientId') patient?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('outstandingOnly') outstanding?: string,
  ) {
    const patientId = patient === undefined ? undefined : Number(patient);
    if (patientId !== undefined && (!Number.isInteger(patientId) || patientId < 1)) {
      throw new BadRequestException('patientId must be a positive integer');
    }
    if (outstanding !== undefined && !['true', 'false'].includes(outstanding)) {
      throw new BadRequestException('outstandingOnly must be true or false');
    }
    const start = this.parseDate(from);
    const end = this.parseDate(to, true);
    if (start && end && start > end) throw new BadRequestException('from must be before to');
    return this.billing.findInvoices({
      ...(patientId !== undefined ? { patientId } : {}),
      ...(start ? { from: start } : {}),
      ...(end ? { to: end } : {}),
      ...(outstanding === 'true' ? { outstandingOnly: true } : {}),
    });
  }

  @Get('invoices/pending-verification')
  @Roles('ADMIN', 'ACCOUNTANT')
  pendingVerification() {
    return this.billing.pendingVerification();
  }

  @Get('invoices/:id')
  @Roles('ADMIN', 'RECEPTIONIST', 'ACCOUNTANT')
  @Permissions('INVOICE_VIEW')
  findInvoice(@Param('id', ParseIntPipe) id: number) {
    return this.billing.findInvoice(id);
  }

  @Patch('invoices/:id')
  @Roles('ADMIN', 'RECEPTIONIST')
  updateInvoice(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateInvoiceDto, @Req() req: any) {
    return this.billing.updateInvoice(id, dto, req.user.userId);
  }

  @Post('invoices/:id/submit')
  @Roles('ADMIN', 'RECEPTIONIST')
  submitInvoice(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.billing.submitInvoice(id, req.user.userId);
  }

  @Post('invoices/:id/verify')
  @Roles('ADMIN', 'ACCOUNTANT')
  verifyInvoice(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.billing.verifyInvoice(id, req.user.userId);
  }

  @Post('invoices/:id/reject')
  @Roles('ADMIN', 'ACCOUNTANT')
  rejectInvoice(@Param('id', ParseIntPipe) id: number, @Body() dto: RejectInvoiceDto, @Req() req: any) {
    return this.billing.rejectInvoice(id, dto.reason, req.user.userId);
  }

  @Post('invoices/:id/payments')
  @Roles('ADMIN', 'RECEPTIONIST', 'ACCOUNTANT')
  @Permissions('PAYMENT_MANAGE')
  recordPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreatePaymentDto,
    @Req() req: any,
  ) {
    return this.billing.recordPayment(id, dto, req.user.userId);
  }

  @Get('invoices/:id/payments')
  @Roles('ADMIN', 'RECEPTIONIST', 'ACCOUNTANT')
  @Permissions('INVOICE_VIEW')
  paymentHistory(@Param('id', ParseIntPipe) id: number) {
    return this.billing.paymentHistory(id);
  }

  @Post('invoices/:id/payments/:paymentId/refunds')
  @Roles('ADMIN', 'ACCOUNTANT')
  @Permissions('PAYMENT_MANAGE')
  recordRefund(
    @Param('id', ParseIntPipe) id: number,
    @Param('paymentId', ParseIntPipe) paymentId: number,
    @Body() dto: CreateRefundDto,
    @Req() req: any,
  ) {
    return this.billing.recordRefund(id, paymentId, dto, req.user.userId);
  }

  @Get('charge-preview/:patientId')
  @Roles('ADMIN', 'RECEPTIONIST', 'ACCOUNTANT')
  @Permissions('INVOICE_VIEW')
  chargePreview(@Param('patientId', ParseIntPipe) patientId: number) {
    return this.billing.chargePreview(patientId);
  }

  @Get('collections/daily')
  @Roles('ADMIN', 'ACCOUNTANT')
  @Permissions('REPORT_VIEW')
  dailyCollections(@Query('date') date?: string) {
    return this.billing.dailyCollections(date);
  }

  @Get('statistics/overview')
  @Roles('ADMIN', 'ACCOUNTANT')
  @Permissions('REPORT_VIEW')
  statistics(@Query('from') from?: string, @Query('to') to?: string) {
    const start = this.parseDate(from);
    const end = this.parseDate(to, true);
    if (start && end && start > end) throw new BadRequestException('from must be before to');
    return this.billing.statistics(start, end);
  }

  @Get('statistics/revenue-by-method')
  @Roles('ADMIN', 'ACCOUNTANT')
  @Permissions('REPORT_VIEW')
  revenueByMethod(@Query('from') from?: string, @Query('to') to?: string) {
    const start = this.parseDate(from);
    const end = this.parseDate(to, true);
    if (start && end && start > end) throw new BadRequestException('from must be before to');
    return this.billing.revenueByMethod(start, end);
  }

  @Get('statistics/revenue-by-category')
  @Roles('ADMIN', 'ACCOUNTANT')
  @Permissions('REPORT_VIEW')
  revenueByCategory(@Query('from') from?: string, @Query('to') to?: string) {
    const start = this.parseDate(from);
    const end = this.parseDate(to, true);
    if (start && end && start > end) throw new BadRequestException('from must be before to');
    return this.billing.revenueByCategory(start, end);
  }
}

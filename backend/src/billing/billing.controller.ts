import {
  BadRequestException, Body, Controller, Get, Param, ParseIntPipe,
  Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles/roles.guard.js';
import { Roles } from '../auth/roles/roles.decorator.js';
import { BillingService } from './services/billing.service.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';

@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles('ADMIN', 'RECEPTIONIST', 'ACCOUNTANT')
  createInvoice(@Body() dto: CreateInvoiceDto, @Req() req: any) {
    return this.billing.createInvoice(dto, req.user.userId);
  }

  @Get('invoices')
  @Roles('ADMIN', 'RECEPTIONIST', 'ACCOUNTANT')
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

  @Get('invoices/:id')
  @Roles('ADMIN', 'RECEPTIONIST', 'ACCOUNTANT')
  findInvoice(@Param('id', ParseIntPipe) id: number) {
    return this.billing.findInvoice(id);
  }

  @Post('invoices/:id/payments')
  @Roles('ADMIN', 'RECEPTIONIST', 'ACCOUNTANT')
  recordPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreatePaymentDto,
    @Req() req: any,
  ) {
    return this.billing.recordPayment(id, dto, req.user.userId);
  }

  @Get('invoices/:id/payments')
  @Roles('ADMIN', 'RECEPTIONIST', 'ACCOUNTANT')
  paymentHistory(@Param('id', ParseIntPipe) id: number) {
    return this.billing.paymentHistory(id);
  }

  @Get('statistics/overview')
  @Roles('ADMIN', 'ACCOUNTANT')
  statistics(@Query('from') from?: string, @Query('to') to?: string) {
    const start = this.parseDate(from);
    const end = this.parseDate(to, true);
    if (start && end && start > end) throw new BadRequestException('from must be before to');
    return this.billing.statistics(start, end);
  }

  @Get('statistics/revenue-by-method')
  @Roles('ADMIN', 'ACCOUNTANT')
  revenueByMethod(@Query('from') from?: string, @Query('to') to?: string) {
    const start = this.parseDate(from);
    const end = this.parseDate(to, true);
    if (start && end && start > end) throw new BadRequestException('from must be before to');
    return this.billing.revenueByMethod(start, end);
  }
}

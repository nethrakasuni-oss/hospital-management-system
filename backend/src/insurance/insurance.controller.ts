import {
  BadRequestException, Body, Controller, Get, Param, ParseIntPipe,
  Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { InsuranceService } from './insurance.service.js';
import { CreateInsuranceProviderDto } from './dto/create-insurance-provider.dto.js';
import { UpdateInsuranceProviderDto } from './dto/update-insurance-provider.dto.js';
import { CreatePatientInsuranceDto } from './dto/create-patient-insurance.dto.js';
import { UpdatePatientInsuranceDto } from './dto/update-patient-insurance.dto.js';
import { CreateInsuranceClaimDto } from './dto/create-insurance-claim.dto.js';
import { ReviewInsuranceClaimDto } from './dto/review-insurance-claim.dto.js';
import { RecordInsuranceClaimPaymentDto } from './dto/record-insurance-claim-payment.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles/roles.guard.js';
import { Roles } from '../auth/roles/roles.decorator.js';

@Controller('insurance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InsuranceController {
  constructor(private readonly insurance: InsuranceService) {}

  @Post('providers')
  @Roles('ADMIN', 'HR_MANAGER')
  createProvider(@Body() dto: CreateInsuranceProviderDto, @Req() req: any) {
    return this.insurance.createProvider(dto, req.user.userId);
  }

  @Get('providers')
  @Roles('ADMIN', 'HR_MANAGER', 'RECEPTIONIST', 'ACCOUNTANT', 'DOCTOR')
  findProviders(@Query('includeInactive') includeInactive?: string) {
    if (includeInactive !== undefined && !['true', 'false'].includes(includeInactive)) {
      throw new BadRequestException('includeInactive must be true or false');
    }
    return this.insurance.findProviders(includeInactive === 'true');
  }

  @Get('providers/:id')
  @Roles('ADMIN', 'HR_MANAGER', 'RECEPTIONIST', 'ACCOUNTANT', 'DOCTOR')
  findProvider(@Param('id', ParseIntPipe) id: number) {
    return this.insurance.findProvider(id);
  }

  @Patch('providers/:id')
  @Roles('ADMIN', 'HR_MANAGER')
  updateProvider(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInsuranceProviderDto,
    @Req() req: any,
  ) {
    return this.insurance.updateProvider(id, dto, req.user.userId);
  }

  @Post('policies')
  @Roles('ADMIN', 'HR_MANAGER', 'RECEPTIONIST', 'ACCOUNTANT')
  createPolicy(@Body() dto: CreatePatientInsuranceDto, @Req() req: any) {
    return this.insurance.createPolicy(dto, req.user.userId);
  }

  @Get('policies')
  @Roles('ADMIN', 'HR_MANAGER', 'RECEPTIONIST', 'ACCOUNTANT', 'DOCTOR')
  findPolicies(
    @Query('patientId') patientId?: string,
    @Query('providerId') providerId?: string,
    @Query('active') active?: string,
  ) {
    if (active !== undefined && !['true', 'false'].includes(active)) {
      throw new BadRequestException('active must be true or false');
    }
    const patient = this.parseOptionalPositiveInt(patientId, 'patientId');
    const provider = this.parseOptionalPositiveInt(providerId, 'providerId');
    return this.insurance.findPolicies({
      ...(patient !== undefined ? { patientId: patient } : {}),
      ...(provider !== undefined ? { providerId: provider } : {}),
      ...(active !== undefined ? { active: active === 'true' } : {}),
    });
  }

  @Get('policies/:id')
  @Roles('ADMIN', 'HR_MANAGER', 'RECEPTIONIST', 'ACCOUNTANT', 'DOCTOR')
  findPolicy(@Param('id', ParseIntPipe) id: number) {
    return this.insurance.findPolicy(id);
  }

  @Patch('policies/:id')
  @Roles('ADMIN', 'HR_MANAGER', 'RECEPTIONIST', 'ACCOUNTANT')
  updatePolicy(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePatientInsuranceDto,
    @Req() req: any,
  ) {
    return this.insurance.updatePolicy(id, dto, req.user.userId);
  }

  @Post('claims')
  @Roles('ADMIN', 'HR_MANAGER', 'RECEPTIONIST', 'ACCOUNTANT')
  createClaim(@Body() dto: CreateInsuranceClaimDto, @Req() req: any) {
    return this.insurance.createClaim(dto, req.user.userId);
  }

  @Get('claims')
  @Roles('ADMIN', 'HR_MANAGER', 'RECEPTIONIST', 'ACCOUNTANT', 'DOCTOR')
  findClaims(
    @Query('patientId') patientId?: string,
    @Query('providerId') providerId?: string,
    @Query('status') status?: string,
  ) {
    const patient = this.parseOptionalPositiveInt(patientId, 'patientId');
    const provider = this.parseOptionalPositiveInt(providerId, 'providerId');
    const allowed = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'];
    if (status && !allowed.includes(status)) throw new BadRequestException('Invalid insurance claim status');
    return this.insurance.findClaims({
      ...(patient !== undefined ? { patientId: patient } : {}),
      ...(provider !== undefined ? { providerId: provider } : {}),
      ...(status ? { status } : {}),
    });
  }

  @Get('claims/:id')
  @Roles('ADMIN', 'HR_MANAGER', 'RECEPTIONIST', 'ACCOUNTANT', 'DOCTOR')
  findClaim(@Param('id', ParseIntPipe) id: number) {
    return this.insurance.findClaim(id);
  }

  @Patch('claims/:id/submit')
  @Roles('ADMIN', 'HR_MANAGER', 'RECEPTIONIST', 'ACCOUNTANT')
  submitClaim(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.insurance.submitClaim(id, req.user.userId);
  }

  @Patch('claims/:id/review')
  @Roles('ADMIN', 'HR_MANAGER', 'ACCOUNTANT')
  reviewClaim(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewInsuranceClaimDto,
    @Req() req: any,
  ) {
    return this.insurance.reviewClaim(id, req.user.userId, dto);
  }

  // Existing Batch 02 route retained for API compatibility.
  @Patch('claims/:id/payment')
  @Roles('ADMIN', 'ACCOUNTANT')
  recordClaimPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RecordInsuranceClaimPaymentDto,
    @Req() req: any,
  ) {
    return this.insurance.recordClaimPayment(id, dto, req.user.userId);
  }

  @Get('statistics/overview')
  @Roles('ADMIN', 'ACCOUNTANT', 'HR_MANAGER')
  statistics() {
    return this.insurance.statistics();
  }

  private parseOptionalPositiveInt(value: string | undefined, field: string): number | undefined {
    if (value === undefined || value === '') return undefined;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }
    return parsed;
  }
}

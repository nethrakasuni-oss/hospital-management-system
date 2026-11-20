import {
  BadRequestException, Body, Controller, Get, Param, ParseIntPipe,
  Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles/roles.guard.js';
import { Roles } from '../auth/roles/roles.decorator.js';
import { LaboratoryService } from './services/laboratory.service.js';
import { CreateLabTestDto } from './dto/create-lab-test.dto.js';
import { UpdateLabTestDto } from './dto/update-lab-test.dto.js';
import { CreateLabRequestDto } from './dto/create-lab-request.dto.js';
import { UpdateLabRequestStatusDto } from './dto/update-lab-request-status.dto.js';
import { UpsertLabResultDto } from './dto/upsert-lab-result.dto.js';
import { CollectLabSampleDto } from './dto/collect-lab-sample.dto.js';
import { VerifyLabResultDto } from './dto/verify-lab-result.dto.js';
import { Permissions } from '../auth/permissions/permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions/permissions.guard.js';

@Controller('laboratory')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class LaboratoryController {
  constructor(private readonly laboratory: LaboratoryService) {}

  @Post('tests')
  @Roles('ADMIN', 'LAB_MANAGER', 'PATHOLOGIST')
  @Permissions('LAB_RESULT_MANAGE')
  createTest(@Body() dto: CreateLabTestDto) {
    return this.laboratory.createTest(dto);
  }

  @Get('tests')
  @Roles('ADMIN', 'DOCTOR', 'NURSE', 'LAB_TECHNICIAN', 'RECEPTIONIST')
  @Permissions('LAB_REQUEST_VIEW')
  findTests(@Query('includeInactive') includeInactive?: string) {
    return this.laboratory.findTests(includeInactive === 'true');
  }

  @Get('tests/:id')
  @Roles('ADMIN', 'DOCTOR', 'NURSE', 'LAB_TECHNICIAN', 'RECEPTIONIST')
  @Permissions('LAB_REQUEST_VIEW')
  findTest(@Param('id', ParseIntPipe) id: number) {
    return this.laboratory.findTest(id);
  }

  @Patch('tests/:id')
  @Roles('ADMIN', 'LAB_MANAGER', 'PATHOLOGIST')
  @Permissions('LAB_RESULT_MANAGE')
  updateTest(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLabTestDto) {
    return this.laboratory.updateTest(id, dto);
  }

  @Post('requests')
  @Roles('ADMIN', 'DOCTOR')
  @Permissions('LAB_REQUEST_CREATE')
  createRequest(@Body() dto: CreateLabRequestDto, @Req() req: any) {
    return this.laboratory.createRequest(dto, req.user.userId, req.user.role);
  }

  @Get('requests')
  @Roles('ADMIN', 'DOCTOR', 'NURSE', 'LAB_TECHNICIAN', 'RECEPTIONIST')
  @Permissions('LAB_REQUEST_VIEW')
  findRequests(
    @Query('patientId') patientId: string | undefined,
    @Query('doctorId') doctorId: string | undefined,
    @Query('status') status: string | undefined,
    @Req() req: any,
  ) {
    const p = patientId === undefined ? undefined : Number(patientId);
    const d = doctorId === undefined ? undefined : Number(doctorId);
    if (p !== undefined && (!Number.isInteger(p) || p < 1)) throw new BadRequestException('patientId must be a positive integer');
    if (d !== undefined && (!Number.isInteger(d) || d < 1)) throw new BadRequestException('doctorId must be a positive integer');
    const validStatuses = ['REQUESTED', 'SAMPLE_PENDING', 'SAMPLE_COLLECTED', 'RECEIVED', 'PROCESSING', 'RESULT_ENTERED', 'VERIFIED', 'COMPLETED', 'REJECTED', 'CANCELLED'];
    if (status && !validStatuses.includes(status)) throw new BadRequestException('Invalid laboratory request status');
    return this.laboratory.findRequests({
      ...(p !== undefined ? { patientId: p } : {}),
      ...(d !== undefined ? { doctorId: d } : {}),
      ...(status ? { status } : {}),
    }, req.user.userId, req.user.role);
  }

  @Get('requests/:id')
  @Roles('ADMIN', 'DOCTOR', 'NURSE', 'LAB_TECHNICIAN', 'RECEPTIONIST')
  @Permissions('LAB_REQUEST_VIEW')
  findRequest(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.laboratory.findRequest(id, req.user.userId, req.user.role);
  }

  @Patch('requests/:id/status')
  @Roles('ADMIN', 'LAB_TECHNICIAN', 'LAB_MANAGER', 'PATHOLOGIST')
  @Permissions('LAB_RESULT_MANAGE')
  updateRequestStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLabRequestStatusDto,
    @Req() req: any,
  ) {
    return this.laboratory.updateRequestStatus(id, dto, req.user.userId, req.user.role);
  }

  @Post('results')
  @Roles('ADMIN', 'LAB_TECHNICIAN')
  @Permissions('LAB_RESULT_MANAGE')
  upsertResult(@Body() dto: UpsertLabResultDto, @Req() req: any) {
    return this.laboratory.upsertResult(dto, req.user.userId, req.user.role);
  }

  @Post('samples/collect')
  @Roles('ADMIN', 'NURSE', 'LAB_TECHNICIAN', 'LAB_MANAGER', 'PATHOLOGIST')
  @Permissions('LAB_REQUEST_CREATE')
  collectSample(@Body() dto: CollectLabSampleDto, @Req() req: any) {
    return this.laboratory.collectSample(dto, req.user.userId);
  }

  @Patch('results/:labRequestItemId/verify')
  @Roles('ADMIN', 'LAB_MANAGER', 'PATHOLOGIST')
  @Permissions('LAB_RESULT_MANAGE')
  verifyResult(
    @Param('labRequestItemId', ParseIntPipe) labRequestItemId: number,
    @Body() dto: VerifyLabResultDto,
    @Req() req: any,
  ) {
    return this.laboratory.verifyResult(labRequestItemId, dto, req.user.userId);
  }

  @Get('requests/:id/report')
  @Roles('ADMIN', 'DOCTOR', 'NURSE', 'LAB_TECHNICIAN', 'LAB_MANAGER', 'PATHOLOGIST')
  @Permissions('LAB_REQUEST_VIEW')
  report(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.laboratory.report(id, req.user.userId, req.user.role);
  }

  @Get('statistics/overview')
  @Roles('ADMIN', 'LAB_TECHNICIAN', 'LAB_MANAGER', 'PATHOLOGIST')
  @Permissions('LAB_REQUEST_VIEW')
  statistics() {
    return this.laboratory.statistics();
  }
}

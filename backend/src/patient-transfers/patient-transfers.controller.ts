import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PatientTransfersService } from './patient-transfers.service.js';
import { CreatePatientTransferDto } from './dto/create-patient-transfer.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles/roles.guard.js';
import { Roles } from '../auth/roles/roles.decorator.js';

@Controller('patient-transfers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientTransfersController {
  constructor(private readonly service: PatientTransfersService) {}
  @Post() @Roles('ADMIN', 'DOCTOR', 'NURSE') create(@Body() dto: CreatePatientTransferDto, @Req() req: any) { return this.service.create(dto, req.user.userId); }
  @Get() @Roles('ADMIN', 'DOCTOR', 'NURSE', 'HR_MANAGER') findAll(@Query('status') status?: string, @Query('patientId') patientId?: string) { return this.service.findAll(status, patientId ? Number(patientId) : undefined); }
  @Get(':id') @Roles('ADMIN', 'DOCTOR', 'NURSE', 'HR_MANAGER') findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }
  @Patch(':id/approve') @Roles('ADMIN', 'HR_MANAGER', 'DOCTOR') approve(@Param('id', ParseIntPipe) id: number, @Req() req: any) { return this.service.approve(id, req.user.userId); }
  @Patch(':id/reject') @Roles('ADMIN', 'HR_MANAGER', 'DOCTOR') reject(@Param('id', ParseIntPipe) id: number, @Body() body: { notes?: string }) { return this.service.reject(id, body.notes); }
  @Patch(':id/start') @Roles('ADMIN', 'DOCTOR', 'NURSE') start(@Param('id', ParseIntPipe) id: number) { return this.service.start(id); }
  @Patch(':id/complete') @Roles('ADMIN', 'DOCTOR', 'NURSE') complete(@Param('id', ParseIntPipe) id: number) { return this.service.complete(id); }
}

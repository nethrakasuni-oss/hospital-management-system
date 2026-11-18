import {
  Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query,
  Req, UseGuards, BadRequestException,
} from '@nestjs/common';
import { MedicalRecordService } from './services/medical-record.service.js';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto.js';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles/roles.guard.js';
import { Roles } from '../auth/roles/roles.decorator.js';

@Controller('medical-records')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MedicalRecordsController {
  constructor(private readonly records: MedicalRecordService) {}

  @Post()
  @Roles('ADMIN', 'DOCTOR')
  create(@Body() dto: CreateMedicalRecordDto, @Req() req: any) {
    return this.records.create(dto, req.user.userId, req.user.role);
  }

  @Get()
  @Roles('ADMIN', 'DOCTOR', 'NURSE')
  findAll(
    @Query('patientId') patientId?: string,
    @Query('doctorId') doctorId?: string,
    @Req() req?: any,
  ) {
    const pId = patientId === undefined ? undefined : Number(patientId);
    const dId = doctorId === undefined ? undefined : Number(doctorId);
    if (pId !== undefined && (!Number.isInteger(pId) || pId < 1)) throw new BadRequestException('patientId must be a positive integer');
    if (dId !== undefined && (!Number.isInteger(dId) || dId < 1)) throw new BadRequestException('doctorId must be a positive integer');
    return this.records.findAll({
      ...(pId !== undefined ? { patientId: pId } : {}),
      ...(dId !== undefined ? { doctorId: dId } : {}),
    }, req.user.userId, req.user.role);
  }

  @Get('statistics/overview')
  @Roles('ADMIN', 'DOCTOR')
  statistics(@Req() req: any) {
    return this.records.statistics(req.user.userId, req.user.role);
  }

  @Get('patient/:patientId/history')
  @Roles('ADMIN', 'DOCTOR', 'NURSE')
  patientHistory(@Param('patientId', ParseIntPipe) patientId: number, @Req() req: any) {
    return this.records.patientHistory(patientId, req.user.userId, req.user.role);
  }

  @Get(':id')
  @Roles('ADMIN', 'DOCTOR', 'NURSE')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.records.findOne(id, req.user.userId, req.user.role);
  }

  @Patch(':id')
  @Roles('ADMIN', 'DOCTOR')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMedicalRecordDto,
    @Req() req: any,
  ) {
    return this.records.update(id, dto, req.user.userId, req.user.role);
  }
}

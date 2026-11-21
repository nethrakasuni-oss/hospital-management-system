
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { PatientsService } from './patients.service.js';

import { CreatePatientDto } from './dto/create-patient.dto.js';
import { UpdatePatientDto } from './dto/update-patient.dto.js';
import { Req } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';

import { PermissionsGuard } from '../auth/permissions/permissions.guard.js';
import { Permissions } from '../auth/permissions/permissions.decorator.js';

@Controller('patients')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  // Register a new patient
  @Post()
  @Permissions('PATIENT_CREATE')
  create(@Body() dto: CreatePatientDto) {
    return this.patientsService.create(dto);
  }

  // Get all patients
  @Get()
  @Permissions('PATIENT_VIEW')
  findAll() {
    return this.patientsService.findAll();
  }

  // Search patients
  @Get('search')
  @Permissions('PATIENT_VIEW')
  search(@Query('q') q: string) {
    return this.patientsService.search(q);
  }

  // Get patient by ID
  @Get(':id')
  @Permissions('PATIENT_VIEW')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.patientsService.findOne(id, req.user?.userId, req.user?.role);
  }

  // Update patient
  @Patch(':id')
  @Permissions('PATIENT_UPDATE')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePatientDto,
  ) {
    return this.patientsService.update(id, dto);
  }

  // Delete patient
  @Delete(':id')
  @Permissions('PATIENT_DELETE')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.patientsService.remove(id);
  }
}

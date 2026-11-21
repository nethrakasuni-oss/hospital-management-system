
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  BadRequestException,
  Req,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles/roles.guard.js';
import { Roles } from '../auth/roles/roles.decorator.js';

import { InpatientService } from './inpatient.service.js';

import { CreateWardDto } from './dto/create-ward.dto.js';
import { UpdateWardDto } from './dto/update-ward.dto.js';
import { CreateRoomDto } from './dto/create-room.dto.js';
import { CreateBedDto } from './dto/create-bed.dto.js';
import { UpdateBedDto } from './dto/update-bed.dto.js';
import { CreateAdmissionDto } from './dto/create-admission.dto.js';

@Controller('inpatient')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InpatientController {
  constructor(private readonly service: InpatientService) {}

  private positiveId(value?: string, field = 'ID') {
    if (value === undefined) return undefined;

    const id = Number(value);

    if (!Number.isInteger(id) || id < 1) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }

    return id;
  }

  // =========================
  // DASHBOARD
  // =========================

  @Get('dashboard')
  @Roles('ADMIN', 'HR_MANAGER', 'DOCTOR', 'NURSE')
  dashboard() {
    return this.service.dashboardStatistics();
  }

  // =========================
  // WARDS
  // =========================

  @Post('wards')
  @Roles('ADMIN', 'HR_MANAGER')
  createWard(@Body() dto: CreateWardDto) {
    return this.service.createWard(dto);
  }

  @Get('wards')
  @Roles('ADMIN', 'HR_MANAGER', 'DOCTOR', 'NURSE')
  findAllWards() {
    return this.service.findAllWards();
  }

  @Get('wards/:id')
  @Roles('ADMIN', 'HR_MANAGER', 'DOCTOR', 'NURSE')
  findWard(@Param('id', ParseIntPipe) id: number) {
    return this.service.findWard(id);
  }

  @Patch('wards/:id')
  @Roles('ADMIN', 'HR_MANAGER')
  updateWard(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWardDto,
  ) {
    return this.service.updateWard(id, dto);
  }

  // =========================
  // ROOMS
  // =========================

  @Post('rooms')
  @Roles('ADMIN', 'HR_MANAGER')
  createRoom(@Body() dto: CreateRoomDto) {
    return this.service.createRoom(dto);
  }

  @Get('rooms')
  @Roles('ADMIN', 'HR_MANAGER', 'DOCTOR', 'NURSE')
  findAllRooms(@Query('wardId') wardId?: string) {
    return this.service.findAllRooms(
      this.positiveId(wardId, 'wardId'),
    );
  }

  // =========================
  // BEDS
  // =========================

  @Post('beds')
  @Roles('ADMIN', 'HR_MANAGER')
  createBed(@Body() dto: CreateBedDto) {
    return this.service.createBed(dto);
  }

  @Get('beds')
  @Roles('ADMIN', 'HR_MANAGER', 'DOCTOR', 'NURSE')
  findAllBeds(
    @Query('wardId') wardId?: string,
    @Query('roomId') roomId?: string,
    @Query('status') status?: string,
  ) {
    const allowedStatuses = [
      'AVAILABLE',
      'OCCUPIED',
      'MAINTENANCE',
      'UNAVAILABLE',
    ];

    if (status && !allowedStatuses.includes(status)) {
      throw new BadRequestException('Invalid bed status');
    }

    return this.service.findAllBeds(
      this.positiveId(wardId, 'wardId'),
      this.positiveId(roomId, 'roomId'),
      status,
    );
  }

  @Patch('beds/:id')
  @Roles('ADMIN', 'HR_MANAGER')
  updateBed(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBedDto,
  ) {
    return this.service.updateBed(id, dto);
  }

  // =========================
  // ADMISSIONS
  // =========================

  @Post('admissions')
  @Roles('ADMIN', 'DOCTOR', 'NURSE')
  createAdmission(@Body() dto: CreateAdmissionDto) {
    return this.service.createAdmission(dto);
  }

  @Get('admissions')
  @Roles('ADMIN', 'HR_MANAGER', 'DOCTOR', 'NURSE')
  findAllAdmissions(
    @Query('patientId') patientId?: string,
    @Query('status') status?: string,
    @Req() req?: any,
  ) {
    const allowedStatuses = [
      'ADMITTED',
      'DISCHARGED',
      'TRANSFERRED',
      'CANCELLED',
    ];

    if (status && !allowedStatuses.includes(status)) {
      throw new BadRequestException('Invalid admission status');
    }

    if (req?.user?.role === 'NURSE') {
      return this.service.findNurseAdmissions(req.user.userId, status);
    }
    return this.service.findAllAdmissions(
      this.positiveId(patientId, 'patientId'),
      status,
    );
  }

  @Get('admissions/:id')
  @Roles('ADMIN', 'HR_MANAGER', 'DOCTOR', 'NURSE')
  findAdmission(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.findAdmissionForUser(id, req.user.userId, req.user.role);
  }
}

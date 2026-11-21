
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
  DefaultValuePipe,
  BadRequestException,
} from '@nestjs/common';

import { DepartmentsService } from './departments.service.js';

import { CreateDepartmentDto } from './dto/create-department.dto.js';
import { UpdateDepartmentDto } from './dto/update-department.dto.js';
import { AssignDepartmentHeadDto } from './dto/assign-department-head.dto.js';
import { AssignDoctorDto } from './dto/assign-doctor.dto.js';

import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles/roles.guard.js';
import { Roles } from '../auth/roles/roles.decorator.js';

@Controller('departments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepartmentsController {
  constructor(
    private readonly departmentsService: DepartmentsService,
  ) {}

  // ==========================================
  // DEPARTMENT PROFILE
  // ==========================================

  @Post()
  @Roles('ADMIN', 'HR_MANAGER')
  create(@Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(dto);
  }

  @Get()
  @Roles('ADMIN', 'HR_MANAGER', 'RECEPTIONIST', 'DOCTOR')
  findAll() {
    return this.departmentsService.findAll();
  }

  // ==========================================
  // DEPARTMENT SEARCH
  // Keep static routes before :id routes
  // ==========================================

  @Get('search')
  @Roles('ADMIN', 'HR_MANAGER', 'RECEPTIONIST', 'DOCTOR')
  search(
    @Query('search') search?: string,
    @Query('active') active?: string,
    @Query('headEmployeeId') headEmployeeId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page?: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe)
    limit?: number,
  ) {
    if (
      active !== undefined &&
      active !== 'true' &&
      active !== 'false'
    ) {
      throw new BadRequestException(
        'active must be true or false',
      );
    }

    let parsedHeadEmployeeId: number | undefined;

    if (headEmployeeId !== undefined) {
      parsedHeadEmployeeId = Number(headEmployeeId);

      if (
        !Number.isInteger(parsedHeadEmployeeId) ||
        parsedHeadEmployeeId < 1
      ) {
        throw new BadRequestException(
          'Invalid department head employee ID',
        );
      }
    }

    return this.departmentsService.search({
      search,
      active:
        active !== undefined ? active === 'true' : undefined,
      headEmployeeId: parsedHeadEmployeeId,
      page,
      limit,
    });
  }

  @Get('active')
  @Roles('ADMIN', 'HR_MANAGER', 'RECEPTIONIST', 'DOCTOR')
  getActiveDepartments() {
    return this.departmentsService.getActiveDepartments();
  }

  @Get('inactive')
  @Roles('ADMIN', 'HR_MANAGER')
  getInactiveDepartments() {
    return this.departmentsService.getInactiveDepartments();
  }

  @Get('code/:code')
  @Roles('ADMIN', 'HR_MANAGER', 'RECEPTIONIST', 'DOCTOR')
  findByCode(@Param('code') code: string) {
    return this.departmentsService.findByCode(code);
  }

  // ==========================================
  // DEPARTMENT STATISTICS
  // ==========================================

  @Get('statistics/overview')
  @Roles('ADMIN', 'HR_MANAGER')
  getOverallStatistics() {
    return this.departmentsService.getOverallStatistics();
  }

  @Get('statistics/staffing')
  @Roles('ADMIN', 'HR_MANAGER')
  getStaffingSummary() {
    return this.departmentsService.getStaffingSummary();
  }

  @Get('statistics/without-head')
  @Roles('ADMIN', 'HR_MANAGER')
  getDepartmentsWithoutHead() {
    return this.departmentsService.getDepartmentsWithoutHead();
  }

  // ==========================================
  // DEPARTMENT HEAD MANAGEMENT
  // ==========================================

  @Post(':id/head')
  @Roles('ADMIN', 'HR_MANAGER')
  assignDepartmentHead(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignDepartmentHeadDto,
  ) {
    return this.departmentsService.assignDepartmentHead(
      id,
      dto,
    );
  }

  @Delete(':id/head')
  @Roles('ADMIN', 'HR_MANAGER')
  removeDepartmentHead(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.departmentsService.removeDepartmentHead(id);
  }

  // ==========================================
  // DOCTOR ASSIGNMENT
  // ==========================================

  @Post(':id/doctors')
  @Roles('ADMIN', 'HR_MANAGER')
  assignDoctor(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignDoctorDto,
  ) {
    return this.departmentsService.assignDoctor(id, dto);
  }

  @Delete(':id/doctors/:doctorId')
  @Roles('ADMIN', 'HR_MANAGER')
  removeDoctor(
    @Param('id', ParseIntPipe) id: number,
    @Param('doctorId', ParseIntPipe) doctorId: number,
  ) {
    return this.departmentsService.removeDoctor(
      id,
      doctorId,
    );
  }

  // ==========================================
  // EMPLOYEE ASSIGNMENT
  // ==========================================

  @Post(':id/employees/:employeeId')
  @Roles('ADMIN', 'HR_MANAGER')
  assignEmployee(
    @Param('id', ParseIntPipe) id: number,
    @Param('employeeId', ParseIntPipe) employeeId: number,
  ) {
    return this.departmentsService.assignEmployee(
      id,
      employeeId,
    );
  }

  @Delete(':id/employees/:employeeId')
  @Roles('ADMIN', 'HR_MANAGER')
  removeEmployee(
    @Param('id', ParseIntPipe) id: number,
    @Param('employeeId', ParseIntPipe) employeeId: number,
  ) {
    return this.departmentsService.removeEmployee(
      id,
      employeeId,
    );
  }

  // ==========================================
  // DEPARTMENT DETAILS
  // ==========================================

  @Get(':id/statistics')
  @Roles('ADMIN', 'HR_MANAGER', 'RECEPTIONIST', 'DOCTOR')
  getDepartmentStatistics(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.departmentsService.getDepartmentStatistics(
      id,
    );
  }

  @Get(':id')
  @Roles('ADMIN', 'HR_MANAGER', 'RECEPTIONIST', 'DOCTOR')
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.departmentsService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'HR_MANAGER')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(id, dto);
  }

  @Patch(':id/deactivate')
  @Roles('ADMIN', 'HR_MANAGER')
  deactivate(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.departmentsService.deactivate(id);
  }

  @Patch(':id/reactivate')
  @Roles('ADMIN', 'HR_MANAGER')
  reactivate(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.departmentsService.reactivate(id);
  }
}

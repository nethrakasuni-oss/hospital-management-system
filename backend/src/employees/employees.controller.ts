import {
  BadRequestException,
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

import { EmployeesService } from './employees.service.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { AssignEmployeeDepartmentDto } from './dto/assign-employee-department.dto.js';
import { UpdateEmployeeStatusDto } from './dto/update-employee-status.dto.js';

import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles/roles.guard.js';
import { Roles } from '../auth/roles/roles.decorator.js';

@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @Roles('ADMIN', 'HR_MANAGER')
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Get()
  @Roles('ADMIN', 'HR_MANAGER', 'RECEPTIONIST')
  findAll() {
    return this.employeesService.findAll();
  }

  // Static routes must be declared before :id routes.
  @Get('search')
  @Roles('ADMIN', 'HR_MANAGER', 'RECEPTIONIST')
  search(
    @Query('search') search?: string,
    @Query('departmentId') departmentId?: string,
    @Query('designation') designation?: string,
    @Query('page') pageValue?: string,
    @Query('limit') limitValue?: string,
  ) {
    const page = pageValue === undefined ? 1 : Number(pageValue);
    const limit = limitValue === undefined ? 10 : Number(limitValue);
    const parsedDepartmentId =
      departmentId === undefined ? undefined : Number(departmentId);

    if (!Number.isInteger(page) || !Number.isInteger(limit)) {
      throw new BadRequestException('Page and limit must be integers');
    }

    if (
      parsedDepartmentId !== undefined &&
      !Number.isInteger(parsedDepartmentId)
    ) {
      throw new BadRequestException('departmentId must be an integer');
    }

    return this.employeesService.search({
      search,
      departmentId: parsedDepartmentId,
      designation,
      page,
      limit,
    });
  }

  @Get('statistics/overview')
  @Roles('ADMIN', 'HR_MANAGER')
  getOverview() {
    return this.employeesService.getOverview();
  }

  @Get('department/:departmentId')
  @Roles('ADMIN', 'HR_MANAGER', 'RECEPTIONIST')
  getByDepartment(
    @Param('departmentId', ParseIntPipe) departmentId: number,
  ) {
    return this.employeesService.getByDepartment(departmentId);
  }

  @Post(':id/department')
  @Roles('ADMIN', 'HR_MANAGER')
  assignDepartment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignEmployeeDepartmentDto,
  ) {
    return this.employeesService.assignDepartment(id, dto);
  }

  @Delete(':id/department')
  @Roles('ADMIN', 'HR_MANAGER')
  removeDepartment(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.removeDepartment(id);
  }

  @Post(':id/department-head/:departmentId')
  @Roles('ADMIN', 'HR_MANAGER')
  assignAsDepartmentHead(
    @Param('id', ParseIntPipe) id: number,
    @Param('departmentId', ParseIntPipe) departmentId: number,
  ) {
    return this.employeesService.assignAsDepartmentHead(id, departmentId);
  }

  @Delete(':id/department-head')
  @Roles('ADMIN', 'HR_MANAGER')
  removeAsDepartmentHead(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.removeAsDepartmentHead(id);
  }

  @Get(':id/statistics')
  @Roles('ADMIN', 'HR_MANAGER')
  getEmployeeStatistics(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.getEmployeeStatistics(id);
  }

  @Get(':id')
  @Roles('ADMIN', 'HR_MANAGER', 'RECEPTIONIST')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'HR_MANAGER')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'HR_MANAGER')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEmployeeStatusDto,
  ) {
    return this.employeesService.updateStatus(id, dto.isActive);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.remove(id);
  }
}

import { Injectable } from '@nestjs/common';

import { EmployeeProfileService } from './services/employee-profile.service.js';
import { EmployeeAssignmentService } from './services/employee-assignment.service.js';
import {
  EmployeeSearchService,
  EmployeeSearchOptions,
} from './services/employee-search.service.js';
import { EmployeeStatisticsService } from './services/employee-statistics.service.js';

import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { AssignEmployeeDepartmentDto } from './dto/assign-employee-department.dto.js';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly profile: EmployeeProfileService,
    private readonly assignment: EmployeeAssignmentService,
    private readonly searchService: EmployeeSearchService,
    private readonly statistics: EmployeeStatisticsService,
  ) {}

  create(dto: CreateEmployeeDto) {
    return this.profile.create(dto);
  }

  findAll() {
    return this.profile.findAll();
  }

  findOne(id: number) {
    return this.profile.findOne(id);
  }

  update(id: number, dto: UpdateEmployeeDto) {
    return this.profile.update(id, dto);
  }

  updateStatus(id: number, isActive: boolean) {
    return this.profile.updateStatus(id, isActive);
  }

  remove(id: number) {
    return this.profile.remove(id);
  }

  search(options: EmployeeSearchOptions) {
    return this.searchService.search(options);
  }

  getByDepartment(departmentId: number) {
    return this.searchService.getByDepartment(departmentId);
  }

  assignDepartment(id: number, dto: AssignEmployeeDepartmentDto) {
    return this.assignment.assignDepartment(id, dto);
  }

  removeDepartment(id: number) {
    return this.assignment.removeDepartment(id);
  }

  assignAsDepartmentHead(id: number, departmentId: number) {
    return this.assignment.assignAsDepartmentHead(id, departmentId);
  }

  removeAsDepartmentHead(id: number) {
    return this.assignment.removeAsDepartmentHead(id);
  }

  getOverview() {
    return this.statistics.getOverview();
  }

  getEmployeeStatistics(id: number) {
    return this.statistics.getEmployeeStatistics(id);
  }
}

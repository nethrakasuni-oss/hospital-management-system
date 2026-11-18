
import { Injectable } from '@nestjs/common';

import { DepartmentProfileService } from './services/department-profile.service.js';
import { DepartmentAssignmentService } from './services/department-assignment.service.js';
import { DepartmentSearchService } from './services/department-search.service.js';
import { DepartmentStatisticsService } from './services/department-statistics.service.js';

import { CreateDepartmentDto } from './dto/create-department.dto.js';
import { UpdateDepartmentDto } from './dto/update-department.dto.js';
import { AssignDepartmentHeadDto } from './dto/assign-department-head.dto.js';
import { AssignDoctorDto } from './dto/assign-doctor.dto.js';

import { DepartmentSearchOptions } from './services/department-search.service.js';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly profileService: DepartmentProfileService,
    private readonly assignmentService: DepartmentAssignmentService,
    private readonly searchService: DepartmentSearchService,
    private readonly statisticsService: DepartmentStatisticsService,
  ) {}

  // ==========================================
  // DEPARTMENT PROFILE
  // ==========================================

  create(dto: CreateDepartmentDto) {
    return this.profileService.create(dto);
  }

  findAll() {
    return this.profileService.findAll();
  }

  findOne(id: number) {
    return this.profileService.findOne(id);
  }

  update(id: number, dto: UpdateDepartmentDto) {
    return this.profileService.update(id, dto);
  }

  deactivate(id: number) {
    return this.profileService.deactivate(id);
  }

  reactivate(id: number) {
    return this.profileService.reactivate(id);
  }

  // ==========================================
  // DEPARTMENT SEARCH
  // ==========================================

  search(options: DepartmentSearchOptions) {
    return this.searchService.search(options);
  }

  getActiveDepartments() {
    return this.searchService.getActiveDepartments();
  }

  getInactiveDepartments() {
    return this.searchService.getInactiveDepartments();
  }

  findByCode(code: string) {
    return this.searchService.findByCode(code);
  }

  // ==========================================
  // DEPARTMENT HEAD MANAGEMENT
  // ==========================================

  assignDepartmentHead(
    departmentId: number,
    dto: AssignDepartmentHeadDto,
  ) {
    return this.assignmentService.assignDepartmentHead(
      departmentId,
      dto,
    );
  }

  removeDepartmentHead(departmentId: number) {
    return this.assignmentService.removeDepartmentHead(
      departmentId,
    );
  }

  // ==========================================
  // DOCTOR ASSIGNMENT
  // ==========================================

  assignDoctor(
    departmentId: number,
    dto: AssignDoctorDto,
  ) {
    return this.assignmentService.assignDoctor(
      departmentId,
      dto,
    );
  }

  removeDoctor(departmentId: number, doctorId: number) {
    return this.assignmentService.removeDoctor(
      departmentId,
      doctorId,
    );
  }

  // ==========================================
  // EMPLOYEE ASSIGNMENT
  // ==========================================

  assignEmployee(
    departmentId: number,
    employeeId: number,
  ) {
    return this.assignmentService.assignEmployee(
      departmentId,
      employeeId,
    );
  }

  removeEmployee(
    departmentId: number,
    employeeId: number,
  ) {
    return this.assignmentService.removeEmployee(
      departmentId,
      employeeId,
    );
  }

  // ==========================================
  // DEPARTMENT STATISTICS
  // ==========================================

  getOverallStatistics() {
    return this.statisticsService.getOverallStatistics();
  }

  getDepartmentStatistics(departmentId: number) {
    return this.statisticsService.getDepartmentStatistics(
      departmentId,
    );
  }

  getStaffingSummary() {
    return this.statisticsService.getStaffingSummary();
  }

  getDepartmentsWithoutHead() {
    return this.statisticsService.getDepartmentsWithoutHead();
  }
}

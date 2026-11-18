
import { Injectable } from '@nestjs/common';

import { DoctorProfileService } from './services/doctor-profile.service.js';
import { DoctorScheduleService } from './services/doctor-schedule.service.js';
import { DoctorAvailabilityService } from './services/doctor-availability.service.js';
import { DoctorLeaveService } from './services/doctor-leave.service.js';
import { DoctorSearchService } from './services/doctor-search.service.js';

import { CreateDoctorDto } from './dto/create-doctor.dto.js';
import { UpdateDoctorDto } from './dto/update-doctor.dto.js';
import { CreateDoctorScheduleDto } from './dto/create-doctor-schedule.dto.js';
import { CreateDoctorAvailabilityDto } from './dto/create-doctor-availability.dto.js';
import { CreateDoctorLeaveDto } from './dto/create-doctor-leave.dto.js';
import { ReviewDoctorLeaveDto } from './dto/review-doctor-leave.dto.js';
import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DoctorsService {
    constructor(
    private readonly prisma: PrismaService,
    private readonly profileService: DoctorProfileService,
    private readonly scheduleService: DoctorScheduleService,
    private readonly availabilityService: DoctorAvailabilityService,
    private readonly leaveService: DoctorLeaveService,
    private readonly searchService: DoctorSearchService,
  ) {}

  // DOCTOR PROFILE

  create(dto: CreateDoctorDto) {
    return this.profileService.create(dto);
  }

  findAll() {
    return this.profileService.findAll();
  }

  findOne(id: number) {
    return this.profileService.findOne(id);
  }

  update(id: number, dto: UpdateDoctorDto) {
    return this.profileService.update(id, dto);
  }

  deactivate(id: number) {
    return this.profileService.deactivate(id);
  }

  reactivate(id: number) {
    return this.profileService.reactivate(id);
  }

  // DOCTOR SEARCH

  search(options: {
    search?: string;
    specialization?: string;
    departmentId?: number;
    active?: boolean;
    page?: number;
    limit?: number;
  }) {
    return this.searchService.search(options);
  }

  getSpecializations() {
    return this.searchService.getSpecializations();
  }

  getDepartmentDoctors(departmentId: number) {
    return this.searchService.getDepartmentDoctors(departmentId);
  }

  // DOCTOR SCHEDULE

  createSchedule(doctorId: number, dto: CreateDoctorScheduleDto) {
    return this.scheduleService.create(doctorId, dto);
  }

  getSchedules(doctorId: number) {
    return this.scheduleService.findAll(doctorId);
  }

  updateSchedule(
    doctorId: number,
    scheduleId: number,
    dto: CreateDoctorScheduleDto,
  ) {
    return this.scheduleService.update(doctorId, scheduleId, dto);
  }

  deleteSchedule(doctorId: number, scheduleId: number) {
    return this.scheduleService.delete(doctorId, scheduleId);
  }

  // DOCTOR AVAILABILITY

  setAvailability(
    doctorId: number,
    dto: CreateDoctorAvailabilityDto,
  ) {
    return this.availabilityService.set(doctorId, dto);
  }

  getAvailability(
    doctorId: number,
    startDate?: string,
    endDate?: string,
  ) {
    return this.availabilityService.findAll(
      doctorId,
      startDate,
      endDate,
    );
  }

  getAvailabilityByDate(doctorId: number, date: string) {
    return this.availabilityService.findByDate(doctorId, date);
  }

  deleteAvailability(doctorId: number, availabilityId: number) {
    return this.availabilityService.delete(doctorId, availabilityId);
  }

  // DOCTOR LEAVE

  createLeave(doctorId: number, dto: CreateDoctorLeaveDto) {
    return this.leaveService.create(doctorId, dto);
  }

  getDoctorLeaves(doctorId: number) {
    return this.leaveService.findAll(doctorId);
  }

  getPendingLeaves() {
    return this.leaveService.findPending();
  }

  getLeave(leaveId: number) {
    return this.leaveService.findOne(leaveId);
  }

  reviewLeave(
    leaveId: number,
    reviewerId: number,
    dto: ReviewDoctorLeaveDto,
  ) {
    return this.leaveService.review(leaveId, reviewerId, dto);
  }

  cancelLeave(doctorId: number, leaveId: number) {
    return this.leaveService.cancel(doctorId, leaveId);
    }
    

  // ==========================================
  // DOCTOR OWNERSHIP VALIDATION
  // ==========================================

  async assertDoctorOwnership(
    doctorId: number,
    userId: number,
  ) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    if (doctor.userId !== userId) {
      throw new ForbiddenException(
        'You cannot access another doctor account',
      );
    }

    return doctor;
  }

  // ==========================================
  // LEAVE OWNERSHIP VALIDATION
  // ==========================================

  async assertLeaveOwnership(
    leaveId: number,
    userId: number,
  ) {
    const leave = await this.prisma.doctorLeave.findUnique({
      where: { id: leaveId },
      select: {
        id: true,
        doctor: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!leave) {
      throw new NotFoundException('Leave request not found');
    }

    if (leave.doctor.userId !== userId) {
      throw new ForbiddenException(
        'You cannot access another doctor leave request',
      );
    }

    return leave;
  }

}

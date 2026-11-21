import { Injectable } from '@nestjs/common';
import { AppointmentStatus } from '../generated/prisma/client.js';
import { CreateAppointmentDto } from './dto/create-appointment.dto.js';
import { UpdateAppointmentDto } from './dto/update-appointment.dto.js';
import { AppointmentProfileService } from './services/appointment-profile.service.js';
import { AppointmentScheduleService } from './services/appointment-schedule.service.js';
import { AppointmentSearchService, AppointmentSearchOptions } from './services/appointment-search.service.js';
import { AppointmentStatisticsService } from './services/appointment-statistics.service.js';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly profile: AppointmentProfileService,
    private readonly schedule: AppointmentScheduleService,
    private readonly searchService: AppointmentSearchService,
    private readonly statistics: AppointmentStatisticsService,
  ) {}

  create(dto: CreateAppointmentDto, userId?: number, role?: string) { return this.profile.create(dto, userId, role); }
  findAll(doctorId?: number) {
  return this.profile.findAll(doctorId);
  }
findOne(id: number, doctorId?: number) {
  return this.profile.findOne(id, doctorId);
  }
  update(id: number, dto: UpdateAppointmentDto) { return this.profile.update(id, dto); }
  cancel(id: number, reason?: string) { return this.profile.cancel(id, reason); }
  updateStatus(id: number, status: AppointmentStatus, notes?: string, doctorId?: number) {
    return this.profile.updateStatus(id, status, notes, doctorId);
  }
  remove(id: number) { return this.profile.remove(id); }
search(options: AppointmentSearchOptions, doctorId?: number) {
  return this.searchService.search({
    ...options,
    ...(doctorId !== undefined ? { doctorId } : {}),
  });
  }
  getDoctorAppointments(doctorId: number, date?: string) {
    return this.schedule.getDoctorAppointments(doctorId, date);
  }
  getDailySchedule(date: string) { return this.schedule.getDailySchedule(date); }
  getOverview(from?: string, to?: string) { return this.statistics.getOverview(from, to); }
  getDoctorStatistics(doctorId: number, from?: string, to?: string) {
    return this.statistics.getDoctorStatistics(doctorId, from, to);
  }
  getDoctorIdForUser(userId: number) {
  return this.profile.getDoctorIdForUser(userId);
  }
  getAvailableSlots(
  doctorId: number,
  date: string,
  duration?: number,
) {
  return this.schedule.getAvailableSlots(
    doctorId,
    date,
    duration,
  );
}

  startConsultation(id: number, doctorId: number) {
    return this.profile.startConsultation(id, doctorId);
  }

  completeConsultation(id: number, doctorId: number) {
    return this.profile.completeConsultation(id, doctorId);
  }
}

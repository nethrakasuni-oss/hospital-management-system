import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AppointmentsService } from './appointments.service.js';
import { CreateAppointmentDto } from './dto/create-appointment.dto.js';
import { UpdateAppointmentDto } from './dto/update-appointment.dto.js';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto.js';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles/roles.guard.js';
import { Roles } from '../auth/roles/roles.decorator.js';
import { Permissions } from '../auth/permissions/permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions/permissions.guard.js';

@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  private async doctorScope(req: any): Promise<number | undefined> {
    if (req.user.role !== 'DOCTOR') return undefined;
    return this.appointmentsService.getDoctorIdForUser(req.user.userId);
  }

  @Post()
  @Roles('ADMIN', 'RECEPTIONIST', 'DOCTOR')
  @Permissions('APPOINTMENT_CREATE')
  create(@Body() dto: CreateAppointmentDto, @Req() req: any) {
    return this.appointmentsService.create(dto, req.user.userId, req.user.role);
  }

  @Get()
  @Roles('ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE')
  @Permissions('APPOINTMENT_VIEW')
  async findAll(@Req() req: any) {
    return this.appointmentsService.findAll(await this.doctorScope(req));
  }

  @Get('search')
  @Roles('ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE')
  @Permissions('APPOINTMENT_VIEW')
  async search(
    @Query('search') search?: string,
    @Query('doctorId') doctorId?: string,
    @Query('patientId') patientId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Req() req?: any,
  ) {
    const ownDoctorId = await this.doctorScope(req);
    return this.appointmentsService.search({
      search,
      doctorId: ownDoctorId ?? (doctorId === undefined ? undefined : Number(doctorId)),
      patientId: patientId === undefined ? undefined : Number(patientId),
      departmentId: departmentId === undefined ? undefined : Number(departmentId),
      status,
      from,
      to,
      page: page === undefined ? 1 : Number(page),
      limit: limit === undefined ? 10 : Number(limit),
    }, ownDoctorId);
  }

  @Get('statistics/overview')
  @Roles('ADMIN', 'HR_MANAGER')
  getOverview(@Query('from') from?: string, @Query('to') to?: string) {
    return this.appointmentsService.getOverview(from, to);
  }

  @Get('daily')
  @Roles('ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE')
  @Permissions('APPOINTMENT_VIEW')
  async getDailySchedule(@Query('date') date: string, @Req() req: any) {
    const doctorId = await this.doctorScope(req);
    if (doctorId !== undefined) return this.appointmentsService.getDoctorAppointments(doctorId, date);
    return this.appointmentsService.getDailySchedule(date);
  }

  @Get('availability')
  @Roles('ADMIN', 'RECEPTIONIST', 'DOCTOR')
  @Permissions('APPOINTMENT_VIEW')
  getAvailableSlots(
    @Query('doctorId', ParseIntPipe) doctorId: number,
    @Query('date') date: string,
    @Query('duration') duration?: string,
  ) {
    const parsedDuration = duration === undefined ? 30 : Number(duration);
    return this.appointmentsService.getAvailableSlots(doctorId, date, parsedDuration);
  }

  @Get('doctor/:doctorId/statistics')
  @Roles('ADMIN', 'HR_MANAGER')
  getDoctorStatistics(
    @Param('doctorId', ParseIntPipe) doctorId: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.appointmentsService.getDoctorStatistics(doctorId, from, to);
  }

  @Get('doctor/:doctorId')
  @Roles('ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE')
  @Permissions('APPOINTMENT_VIEW')
  async getDoctorAppointments(
    @Param('doctorId', ParseIntPipe) doctorId: number,
    @Query('date') date?: string,
    @Req() req?: any,
  ) {
    const ownDoctorId = await this.doctorScope(req);
    if (ownDoctorId !== undefined && ownDoctorId !== doctorId) {
      throw new ForbiddenException('You can only view your own appointments');
    }
    return this.appointmentsService.getDoctorAppointments(ownDoctorId ?? doctorId, date);
  }

  @Post(':id/start-consultation')
  @Roles('DOCTOR')
  @Permissions('APPOINTMENT_UPDATE')
  async startConsultation(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const doctorId = await this.doctorScope(req);
    if (doctorId === undefined) throw new ForbiddenException('Doctor profile could not be resolved');
    return this.appointmentsService.startConsultation(id, doctorId);
  }

  @Patch(':id/complete-consultation')
  @Roles('DOCTOR')
  @Permissions('APPOINTMENT_UPDATE')
  async completeConsultation(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const doctorId = await this.doctorScope(req);
    if (doctorId === undefined) throw new ForbiddenException('Doctor profile could not be resolved');
    return this.appointmentsService.completeConsultation(id, doctorId);
  }

  @Get(':id')
  @Roles('ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE')
  @Permissions('APPOINTMENT_VIEW')
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.appointmentsService.findOne(id, await this.doctorScope(req));
  }

  @Patch(':id')
  @Roles('ADMIN', 'RECEPTIONIST')
  @Permissions('APPOINTMENT_UPDATE')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAppointmentDto) {
    return this.appointmentsService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'RECEPTIONIST', 'DOCTOR')
  @Permissions('APPOINTMENT_UPDATE')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAppointmentStatusDto,
    @Req() req: any,
  ) {
    const doctorId = await this.doctorScope(req);
    if (req.user.role === 'DOCTOR' && dto.status !== 'COMPLETED') {
      throw new ForbiddenException('Doctors can only complete consultations');
    }
    return this.appointmentsService.updateStatus(id, dto.status, dto.notes, doctorId);
  }

  @Patch(':id/cancel')
  @Roles('ADMIN', 'RECEPTIONIST')
  @Permissions('APPOINTMENT_DELETE')
  cancel(@Param('id', ParseIntPipe) id: number, @Body() dto: CancelAppointmentDto) {
    return this.appointmentsService.cancel(id, dto.cancellationReason);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentsService.remove(id);
  }
}

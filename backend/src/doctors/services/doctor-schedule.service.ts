
import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateDoctorScheduleDto } from '../dto/create-doctor-schedule.dto.js';

@Injectable()
export class DoctorScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  private toMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private validateTimeRange(start: string, end: string) {
    if (this.toMinutes(end) <= this.toMinutes(start)) {
      throw new BadRequestException(
        'End time must be later than start time',
      );
    }
  }

  async create(doctorId: number, dto: CreateDoctorScheduleDto) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
    });

    if (!doctor || !doctor.active) {
      throw new NotFoundException('Active doctor not found');
    }

    this.validateTimeRange(dto.startTime, dto.endTime);

    const schedules = await this.prisma.doctorSchedule.findMany({
      where: {
        doctorId,
        dayOfWeek: dto.dayOfWeek,
        active: true,
      },
    });

    const overlaps = schedules.some((schedule) =>
      this.toMinutes(dto.startTime) <
        this.toMinutes(schedule.endTime) &&
      this.toMinutes(dto.endTime) >
        this.toMinutes(schedule.startTime),
    );

    if (overlaps) {
      throw new ConflictException(
        'Schedule overlaps an existing working period',
      );
    }

    return this.prisma.doctorSchedule.create({
      data: {
        doctorId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        slotDurationMinutes: dto.slotDurationMinutes ?? 15,
        maxAppointments: dto.maxAppointments,
        active: dto.active ?? true,
      },
    });
  }

  async findAll(doctorId: number) {
    await this.ensureDoctorExists(doctorId);

    return this.prisma.doctorSchedule.findMany({
      where: { doctorId },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' },
      ],
    });
  }

  async update(
    doctorId: number,
    scheduleId: number,
    dto: CreateDoctorScheduleDto,
  ) {
    const schedule = await this.prisma.doctorSchedule.findFirst({
      where: { id: scheduleId, doctorId },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    this.validateTimeRange(dto.startTime, dto.endTime);

    if (dto.active !== false) {
      const schedules = await this.prisma.doctorSchedule.findMany({
        where: {
          doctorId,
          dayOfWeek: dto.dayOfWeek,
          active: true,
          NOT: { id: scheduleId },
        },
      });

      const overlaps = schedules.some((item) =>
        this.toMinutes(dto.startTime) <
          this.toMinutes(item.endTime) &&
        this.toMinutes(dto.endTime) >
          this.toMinutes(item.startTime),
      );

      if (overlaps) {
        throw new ConflictException(
          'Updated schedule overlaps another schedule',
        );
      }
    }

    return this.prisma.doctorSchedule.update({
      where: { id: scheduleId },
      data: {
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        slotDurationMinutes: dto.slotDurationMinutes ?? 15,
        maxAppointments: dto.maxAppointments,
        active: dto.active ?? true,
      },
    });
  }

  async delete(doctorId: number, scheduleId: number) {
    const schedule = await this.prisma.doctorSchedule.findFirst({
      where: { id: scheduleId, doctorId },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return this.prisma.doctorSchedule.delete({
      where: { id: scheduleId },
    });
  }

  private async ensureDoctorExists(doctorId: number) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    return doctor;
  }
}

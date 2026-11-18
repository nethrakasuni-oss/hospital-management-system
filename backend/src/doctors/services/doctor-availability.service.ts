
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateDoctorAvailabilityDto } from '../dto/create-doctor-availability.dto.js';
import { DoctorAvailabilityStatus } from '../../generated/prisma/client.js';

@Injectable()
export class DoctorAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  private toMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  async set(
    doctorId: number,
    dto: CreateDoctorAvailabilityDto,
  ) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
    });

    if (!doctor || !doctor.active) {
      throw new NotFoundException('Active doctor not found');
    }

    const date = new Date(`${dto.date}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date');
    }

    const requiresTime =
      dto.status === DoctorAvailabilityStatus.AVAILABLE ||
      dto.status === DoctorAvailabilityStatus.EXTRA_HOURS;

    if (requiresTime) {
      if (!dto.startTime || !dto.endTime) {
        throw new BadRequestException(
          'Start time and end time are required',
        );
      }

      if (
        this.toMinutes(dto.endTime) <=
        this.toMinutes(dto.startTime)
      ) {
        throw new BadRequestException(
          'End time must be later than start time',
        );
      }
    }

    if (
      dto.status === DoctorAvailabilityStatus.UNAVAILABLE &&
      (dto.startTime || dto.endTime)
    ) {
      throw new BadRequestException(
        'Unavailable dates cannot contain working hours',
      );
    }

    return this.prisma.doctorAvailability.upsert({
      where: {
        doctorId_date: { doctorId, date },
      },
      create: {
        doctorId,
        date,
        status: dto.status,
        startTime: dto.startTime,
        endTime: dto.endTime,
        reason: dto.reason,
      },
      update: {
        status: dto.status,
        startTime: dto.startTime,
        endTime: dto.endTime,
        reason: dto.reason,
      },
    });
  }

  async findAll(
    doctorId: number,
    startDate?: string,
    endDate?: string,
  ) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    if (Boolean(startDate) !== Boolean(endDate)) {
      throw new BadRequestException(
        'Provide both startDate and endDate',
      );
    }

    let dateFilter = {};

    if (startDate && endDate) {
      const start = new Date(`${startDate}T00:00:00.000Z`);
      const end = new Date(`${endDate}T00:00:00.000Z`);

      if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end < start
      ) {
        throw new BadRequestException('Invalid date range');
      }

      dateFilter = { gte: start, lte: end };
    }

    return this.prisma.doctorAvailability.findMany({
      where: {
        doctorId,
        ...(startDate && endDate
          ? { date: dateFilter }
          : {}),
      },
      orderBy: { date: 'asc' },
    });
  }

  async findByDate(doctorId: number, dateString: string) {
    const date = new Date(`${dateString}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date');
    }

    const availability =
      await this.prisma.doctorAvailability.findUnique({
        where: {
          doctorId_date: { doctorId, date },
        },
      });

    if (!availability) {
      return null;
    }

    return availability;
  }

  async delete(doctorId: number, availabilityId: number) {
    const availability =
      await this.prisma.doctorAvailability.findFirst({
        where: {
          id: availabilityId,
          doctorId,
        },
      });

    if (!availability) {
      throw new NotFoundException(
        'Doctor availability record not found',
      );
    }

    return this.prisma.doctorAvailability.delete({
      where: { id: availabilityId },
    });
  }
}

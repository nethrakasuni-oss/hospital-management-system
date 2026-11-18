import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface AppointmentSearchOptions {
  search?: string;
  doctorId?: number;
  patientId?: number;
  departmentId?: number;
  status?: 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AppointmentSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(options: AppointmentSearchOptions) {
    const page = options.page ?? 1;
    const limit = options.limit ?? 10;
    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestException('Page must be a positive integer');
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }

    const scheduledAt: Prisma.DateTimeFilter = {};
    if (options.from) {
      const from = new Date(options.from);
      if (Number.isNaN(from.getTime())) throw new BadRequestException('Invalid from date');
      scheduledAt.gte = from;
    }
    if (options.to) {
      const to = new Date(options.to);
      if (Number.isNaN(to.getTime())) throw new BadRequestException('Invalid to date');
      scheduledAt.lte = to;
    }
    if (options.from && options.to && scheduledAt.gte! > scheduledAt.lte!) {
      throw new BadRequestException('"from" must be earlier than or equal to "to"');
    }

    const where: Prisma.AppointmentWhereInput = {
      ...(options.doctorId !== undefined ? { doctorId: options.doctorId } : {}),
      ...(options.patientId !== undefined ? { patientId: options.patientId } : {}),
      ...(options.departmentId !== undefined ? { departmentId: options.departmentId } : {}),
      ...(options.status ? { status: options.status } : {}),
      ...(options.from || options.to ? { scheduledAt } : {}),
      ...(options.search
        ? {
            OR: [
              { appointmentNo: { contains: options.search, mode: 'insensitive' } },
              { reason: { contains: options.search, mode: 'insensitive' } },
              { patient: { is: { firstName: { contains: options.search, mode: 'insensitive' } } } },
              { patient: { is: { lastName: { contains: options.search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.appointment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { patient: true, doctor: true, department: true },
        orderBy: { scheduledAt: 'desc' },
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }
}

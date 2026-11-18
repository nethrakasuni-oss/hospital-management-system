
import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateDoctorLeaveDto } from '../dto/create-doctor-leave.dto.js';
import { ReviewDoctorLeaveDto } from '../dto/review-doctor-leave.dto.js';
import { LeaveStatus } from '../../generated/prisma/client.js';

@Injectable()
export class DoctorLeaveService {
  constructor(private readonly prisma: PrismaService) {}

  private parseDate(value: string): Date {
    const date = new Date(`${value}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid leave date');
    }

    return date;
  }

  async create(doctorId: number, dto: CreateDoctorLeaveDto) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
    });

    if (!doctor || !doctor.active) {
      throw new NotFoundException('Active doctor not found');
    }

    const startDate = this.parseDate(dto.startDate);
    const endDate = this.parseDate(dto.endDate);

    if (endDate < startDate) {
      throw new BadRequestException(
        'Leave end date cannot be before start date',
      );
    }

    const overlapping = await this.prisma.doctorLeave.findFirst({
      where: {
        doctorId,
        status: {
          in: [LeaveStatus.PENDING, LeaveStatus.APPROVED],
        },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });

    if (overlapping) {
      throw new ConflictException(
        'An overlapping pending or approved leave already exists',
      );
    }

    return this.prisma.doctorLeave.create({
      data: {
        doctorId,
        startDate,
        endDate,
        reason: dto.reason,
        leaveType: dto.leaveType,
      },
    });
  }

  async findAll(doctorId: number) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    return this.prisma.doctorLeave.findMany({
      where: { doctorId },
      include: {
        reviewedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPending() {
    return this.prisma.doctorLeave.findMany({
      where: { status: LeaveStatus.PENDING },
      include: {
        doctor: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(leaveId: number) {
    const leave = await this.prisma.doctorLeave.findUnique({
      where: { id: leaveId },
      include: {
        doctor: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        reviewedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!leave) {
      throw new NotFoundException('Doctor leave request not found');
    }

    return leave;
  }

  async review(
    leaveId: number,
    reviewerId: number,
    dto: ReviewDoctorLeaveDto,
  ) {
    if (
      dto.status !== LeaveStatus.APPROVED &&
      dto.status !== LeaveStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Leave can only be approved or rejected',
      );
    }

    const reviewer = await this.prisma.user.findUnique({
      where: { id: reviewerId },
    });

    if (!reviewer || reviewer.status !== 'ACTIVE') {
      throw new ForbiddenException('Active reviewer account required');
    }

    return this.prisma.$transaction(async (tx) => {
      const leave = await tx.doctorLeave.findUnique({
        where: { id: leaveId },
      });

      if (!leave) {
        throw new NotFoundException('Leave request not found');
      }

      if (leave.status !== LeaveStatus.PENDING) {
        throw new ConflictException(
          'This leave request has already been reviewed',
        );
      }

      if (dto.status === LeaveStatus.APPROVED) {
        const overlapping = await tx.doctorLeave.findFirst({
          where: {
            doctorId: leave.doctorId,
            id: { not: leaveId },
            status: LeaveStatus.APPROVED,
            startDate: { lte: leave.endDate },
            endDate: { gte: leave.startDate },
          },
        });

        if (overlapping) {
          throw new ConflictException(
            'An approved leave overlaps this request',
          );
        }
      }

      return tx.doctorLeave.update({
        where: { id: leaveId },
        data: {
          status: dto.status,
          reviewNotes: dto.reviewNotes,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
        include: {
          doctor: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
          reviewedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    });
  }

  async cancel(doctorId: number, leaveId: number) {
    const leave = await this.prisma.doctorLeave.findFirst({
      where: { id: leaveId, doctorId },
    });

    if (!leave) {
      throw new NotFoundException('Leave request not found');
    }

    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(
        'Only pending leave requests can be cancelled',
      );
    }

    return this.prisma.doctorLeave.update({
      where: { id: leaveId },
      data: { status: LeaveStatus.CANCELLED },
    });
  }
}

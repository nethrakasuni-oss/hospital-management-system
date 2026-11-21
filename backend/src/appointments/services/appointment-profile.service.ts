
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client.js';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';

import { CreateAppointmentDto } from '../dto/create-appointment.dto.js';
import { UpdateAppointmentDto } from '../dto/update-appointment.dto.js';
import { AppointmentBookingService } from './appointment-booking.service.js';

@Injectable()
export class AppointmentProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly booking: AppointmentBookingService,
  ) {}

  private referenceNumber(): string {
    return `APT-${Date.now()}-${randomUUID()
      .slice(0, 8)
      .toUpperCase()}`;
  }

  // CREATE APPOINTMENT

  async create(dto: CreateAppointmentDto, userId?: number, role?: string) {
    const scheduledAt = new Date(dto.scheduledAt);

    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException(
        'Invalid appointment date/time',
      );
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          if (role === 'DOCTOR') {
            if (!userId) throw new ForbiddenException('Doctor account is required');
            const ownDoctor = await tx.doctor.findUnique({
              where: { userId },
              select: { id: true, active: true },
            });
            if (!ownDoctor) throw new ForbiddenException('No doctor profile is linked to this account');
            if (!ownDoctor.active) throw new ForbiddenException('Doctor account is inactive');
            const ownedAppointment = await tx.appointment.findFirst({
              where: { patientId: dto.patientId, doctorId: ownDoctor.id },
              select: { id: true },
            });
            if (!ownedAppointment) {
              throw new ForbiddenException('Doctors can only schedule follow-ups for their own patients');
            }
          }
          // Verify patient

          const patient = await tx.patient.findUnique({
            where: { id: dto.patientId },
            select: { id: true },
          });

          if (!patient) {
            throw new NotFoundException('Patient not found');
          }

          // Verify doctor using actual Prisma fields

          const doctor = await tx.doctor.findUnique({
            where: { id: dto.doctorId },
            select: {
              id: true,
              active: true,
              department: {
                select: {
                  id: true,
                },
              },
            },
          });

          if (!doctor) {
            throw new NotFoundException('Doctor not found');
          }

          if (!doctor.active) {
            throw new BadRequestException(
              'Doctor is not active',
            );
          }

          // Resolve department

          const departmentId =
            dto.departmentId !== undefined &&
            dto.departmentId !== null
              ? dto.departmentId
              : doctor.department?.id ?? null;

          if (departmentId !== null) {
            const department =
              await tx.department.findUnique({
                where: { id: departmentId },
                select: {
                  id: true,
                  isActive: true,
                },
              });

            if (!department) {
              throw new NotFoundException(
                'Department not found',
              );
            }

            if (!department.isActive) {
              throw new BadRequestException(
                'Department is not active',
              );
            }
          }

          // Validate doctor schedule, availability,
          // approved leave and overlapping appointments

          await this.booking.assertDoctorCanTakeAppointment(
            tx,
            dto.doctorId,
            scheduledAt,
            dto.duration ?? 30,
          );

          // Consultation fee belongs to Appointment.
          // Doctor currently has no consultationFee field.

          const fee = new Prisma.Decimal(
            dto.consultationFee ?? 0,
          );

          // Create appointment

          return tx.appointment.create({
            data: {
              appointmentNo: this.referenceNumber(),
              scheduledAt,
              duration: dto.duration ?? 30,

              reason: dto.reason?.trim() || null,
              notes: dto.notes?.trim() || null,

              consultationFee: fee,

              appointmentType:
                dto.appointmentType ?? 'IN_PERSON',

              patientId: dto.patientId,
              doctorId: dto.doctorId,
              departmentId,
            },

            include: {
              patient: true,
              doctor: true,
              department: true,
            },
          });
        },
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error: unknown) {
      const e = error as { code?: string };

      if (e?.code === 'P2034') {
        throw new ConflictException(
          'Booking conflicted with another transaction. Please retry.',
        );
      }

      if (e?.code === 'P2002') {
        throw new ConflictException(
          'Appointment reference already exists',
        );
      }

      throw error;
    }
  }

  // GET ALL APPOINTMENTS

  async findAll(doctorId?: number) {
  return this.prisma.appointment.findMany({
    where: doctorId !== undefined ? { doctorId } : {},
    include: {
      patient: true,
      doctor: true,
      department: true,
    },
    orderBy: {
      scheduledAt: 'desc',
    },
  });
}

  // GET APPOINTMENT BY ID

  async findOne(id: number, doctorId?: number) {
  const appointment = await this.prisma.appointment.findUnique({
    where: { id },
    include: {
      patient: true,
      doctor: true,
      department: true,
    },
  });

  if (!appointment) {
    throw new NotFoundException('Appointment not found');
  }

  if (
    doctorId !== undefined &&
    appointment.doctorId !== doctorId
  ) {
    throw new ForbiddenException(
      'You can only access your own appointments',
    );
  }

  return appointment;
}

  // UPDATE APPOINTMENT

  async update(
    id: number,
    dto: UpdateAppointmentDto,
  ) {
    const current = await this.findOne(id);

    if (
      ['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(
        current.status,
      )
    ) {
      throw new BadRequestException(
        'A cancelled, completed, or no-show appointment cannot be edited',
      );
    }

    const scheduledAt = dto.scheduledAt
      ? new Date(dto.scheduledAt)
      : current.scheduledAt;

    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException(
        'Invalid appointment date/time',
      );
    }

    const duration =
      dto.duration ?? current.duration;

    // Revalidate booking if date or duration changes

    if (
      dto.scheduledAt !== undefined ||
      dto.duration !== undefined
    ) {
      await this.booking.assertDoctorCanTakeAppointment(
        this.prisma,
        current.doctorId,
        scheduledAt,
        duration,
        id,
      );
    }

    // Department handling

    const departmentId =
      dto.departmentId === undefined
        ? current.departmentId
        : dto.departmentId;

    if (departmentId !== null) {
      const department =
        await this.prisma.department.findUnique({
          where: { id: departmentId },
          select: {
            id: true,
            isActive: true,
          },
        });

      if (!department) {
        throw new NotFoundException(
          'Department not found',
        );
      }

      if (!department.isActive) {
        throw new BadRequestException(
          'Department is not active',
        );
      }
    }

    // Update appointment

    return this.prisma.appointment.update({
      where: { id },

      data: {
        ...(dto.scheduledAt !== undefined
          ? { scheduledAt }
          : {}),

        ...(dto.duration !== undefined
          ? { duration }
          : {}),

        ...(dto.reason !== undefined
          ? { reason: dto.reason }
          : {}),

        ...(dto.notes !== undefined
          ? { notes: dto.notes }
          : {}),

        ...(dto.consultationFee !== undefined
          ? {
              consultationFee: new Prisma.Decimal(
                dto.consultationFee,
              ),
            }
          : {}),

        ...(dto.appointmentType !== undefined
          ? {
              appointmentType: dto.appointmentType,
            }
          : {}),

        ...(dto.departmentId !== undefined
          ? { departmentId }
          : {}),
      },

      include: {
        patient: true,
        doctor: true,
        department: true,
      },
    });
  }

  // UPDATE APPOINTMENT STATUS

  async updateStatus(
    id: number,
    status:
      | 'SCHEDULED'
      | 'CONFIRMED'
      | 'COMPLETED'
      | 'CANCELLED'
      | 'NO_SHOW',
    notes?: string,
    doctorId?: number,
  ) {
    const appointment = await this.findOne(id, doctorId);

    if (
      ['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(
        appointment.status,
      )
    ) {
      throw new BadRequestException(
        'This appointment is already in a final state',
      );
    }

    const now = new Date();

    return this.prisma.appointment.update({
      where: { id },

      data: {
        status,

        ...(status === 'CONFIRMED'
          ? { confirmedAt: now }
          : {}),

        ...(status === 'COMPLETED'
          ? { completedAt: now }
          : {}),

        ...(notes !== undefined
          ? { notes }
          : {}),
      },

      include: {
        patient: true,
        doctor: true,
        department: true,
      },
    });
  }

  async startConsultation(id: number, doctorId: number) {
    const appointment = await this.findOne(id, doctorId);
    if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(appointment.status)) {
      throw new BadRequestException('Cancelled, completed, or no-show appointments cannot be started');
    }
    const existingRecord = await this.prisma.medicalRecord.findUnique({
      where: { appointmentId: id },
    });
    if (existingRecord) {
      throw new ConflictException('A consultation already exists for this appointment');
    }
    if (appointment.status === 'SCHEDULED') {
      return this.prisma.appointment.update({
        where: { id },
        data: { status: 'CONFIRMED', confirmedAt: new Date() },
        include: { patient: true, doctor: true, department: true },
      });
    }
    return appointment;
  }

  async completeConsultation(id: number, doctorId: number) {
    const appointment = await this.findOne(id, doctorId);
    if (appointment.status === 'COMPLETED') {
      throw new BadRequestException('This consultation is already completed');
    }
    if (['CANCELLED', 'NO_SHOW'].includes(appointment.status)) {
      throw new BadRequestException('A cancelled or no-show appointment cannot be completed');
    }
    const record = await this.prisma.medicalRecord.findUnique({
      where: { appointmentId: id },
    });
    if (!record) throw new BadRequestException('Save consultation findings before completing the consultation');
    return this.prisma.appointment.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
      include: { patient: true, doctor: true, department: true, medicalRecord: true },
    });
  }

  // CANCEL APPOINTMENT

  async cancel(
    id: number,
    cancellationReason?: string,
  ) {
    const appointment = await this.findOne(id);

    if (
      ['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(
        appointment.status,
      )
    ) {
      throw new BadRequestException(
        'This appointment cannot be cancelled',
      );
    }

    return this.prisma.appointment.update({
      where: { id },

      data: {
        status: 'CANCELLED',

        cancellationReason:
          cancellationReason?.trim() || null,
      },

      include: {
        patient: true,
        doctor: true,
        department: true,
      },
    });
  }

  // DELETE APPOINTMENT

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.appointment.delete({
      where: { id },
    });
  }

  async getDoctorIdForUser(userId: number): Promise<number> {
  const doctor = await this.prisma.doctor.findUnique({
    where: { userId },
    select: {
      id: true,
      active: true,
    },
  });

  if (!doctor || !doctor.active) {
    throw new ForbiddenException(
      'Your account is not linked to an active doctor profile',
    );
  }

  return doctor.id;
}
}

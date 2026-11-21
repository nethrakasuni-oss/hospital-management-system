
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  Prisma,
  PrismaClient,
} from '../../generated/prisma/client.js';

type DbClient = Prisma.TransactionClient | PrismaClient;

@Injectable()
export class AppointmentBookingService {
  /**
   * Configure the backend timezone as Asia/Colombo.
   * This service uses the server's local timezone for
   * schedule weekdays, time comparisons and day boundaries.
   */

  private dateKey(date: Date): string {
    // Prisma @db.Date values are represented as UTC dates.
    return date.toISOString().slice(0, 10);
  }

  private toMinutes(value: string): number {
    const match =
      /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);

    if (!match) {
      throw new BadRequestException(
        `Invalid schedule time: ${value}`,
      );
    }

    return Number(match[1]) * 60 + Number(match[2]);
  }

  /**
   * Validate:
   * 1. Doctor exists and is active.
   * 2. Appointment is in the future.
   * 3. Appointment duration is valid.
   * 4. Doctor is not on approved leave.
   * 5. Doctor has date-specific availability.
   * 6. Appointment fits the doctor's schedule.
   * 7. No overlapping appointment exists.
   * 8. Maximum appointment limit is not exceeded.
   */

  async assertDoctorCanTakeAppointment(
    db: DbClient,
    doctorId: number,
    start: Date,
    durationMinutes: number,
    excludeAppointmentId?: number,
  ): Promise<void> {
    // DATE VALIDATION

    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException(
        'Invalid appointment date/time',
      );
    }

    if (start.getTime() <= Date.now()) {
      throw new BadRequestException(
        'Appointment must be scheduled in the future',
      );
    }

    if (
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 5 ||
      durationMinutes > 480
    ) {
      throw new BadRequestException(
        'Appointment duration must be 5 to 480 minutes',
      );
    }

    // GET DOCTOR

    const doctor = await db.doctor.findUnique({
      where: {
        id: doctorId,
      },

      select: {
        id: true,
        active: true,
        schedules: true,
        availability: true,
        leaves: true,
      },
    });

    if (!doctor) {
      throw new NotFoundException(
        'Doctor not found',
      );
    }

    if (!doctor.active) {
      throw new BadRequestException(
        'Doctor is not active',
      );
    }

    // APPOINTMENT TIME RANGE

    const end = new Date(
      start.getTime() +
        durationMinutes * 60_000,
    );

    const dayStart = new Date(start);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(start);
    dayEnd.setHours(23, 59, 59, 999);

    const appointmentDateKey =
      `${start.getFullYear()}-${String(
        start.getMonth() + 1,
      ).padStart(2, '0')}-${String(
        start.getDate(),
      ).padStart(2, '0')}`;

    // CHECK APPROVED DOCTOR LEAVE

    const startDateKey = appointmentDateKey;

    const endDateKey =
      `${end.getFullYear()}-${String(
        end.getMonth() + 1,
      ).padStart(2, '0')}-${String(
        end.getDate(),
      ).padStart(2, '0')}`;

    const leave = doctor.leaves.find((item) => {
      if (item.status !== 'APPROVED') {
        return false;
      }

      const leaveStart = this.dateKey(
        item.startDate,
      );

      const leaveEnd = this.dateKey(
        item.endDate,
      );

      return (
        startDateKey <= leaveEnd &&
        endDateKey >= leaveStart
      );
    });

    if (leave) {
      throw new BadRequestException(
        'Doctor is on approved leave for this date',
      );
    }

    // CHECK DATE-SPECIFIC AVAILABILITY

    const dateOverride =
      doctor.availability.find(
        (item) =>
          this.dateKey(item.date) ===
          appointmentDateKey,
      );

    let allowedRanges: Array<{
      start: string;
      end: string;
    }> = [];

    if (dateOverride) {
      const overrideStatus = String(
        dateOverride.status,
      );

      if (
        overrideStatus === 'UNAVAILABLE' ||
        overrideStatus === 'CLOSED'
      ) {
        throw new BadRequestException(
          'Doctor is unavailable on this date',
        );
      }

      if (
        (
          overrideStatus === 'AVAILABLE' ||
          overrideStatus === 'EXTRA_HOURS'
        ) &&
        dateOverride.startTime &&
        dateOverride.endTime
      ) {
        allowedRanges = [
          {
            start: dateOverride.startTime,
            end: dateOverride.endTime,
          },
        ];
      } else if (
        overrideStatus === 'AVAILABLE' ||
        overrideStatus === 'EXTRA_HOURS'
      ) {
        allowedRanges = doctor.schedules
          .filter(
            (schedule) =>
              schedule.active &&
              schedule.dayOfWeek === start.getDay(),
          )
          .map((schedule) => ({
            start: schedule.startTime,
            end: schedule.endTime,
          }));
      } else {
        throw new BadRequestException(
          `Unsupported doctor availability status: ${overrideStatus}`,
        );
      }
    } else {
      allowedRanges = doctor.schedules
        .filter(
          (schedule) =>
            schedule.active &&
            schedule.dayOfWeek === start.getDay(),
        )
        .map((schedule) => ({
          start: schedule.startTime,
          end: schedule.endTime,
        }));
    }

    if (allowedRanges.length === 0) {
      throw new BadRequestException(
        'Doctor has no active schedule for this day',
      );
    }

    // CHECK APPOINTMENT FITS SCHEDULE

    const startMinutes =
      start.getHours() * 60 +
      start.getMinutes();

    const endMinutes =
      startMinutes + durationMinutes;

    const withinSchedule = allowedRanges.some(
      (range) => {
        const rangeStart = this.toMinutes(
          range.start,
        );

        const rangeEnd = this.toMinutes(
          range.end,
        );

        return (
          rangeStart < rangeEnd &&
          startMinutes >= rangeStart &&
          endMinutes <= rangeEnd
        );
      },
    );

    if (!withinSchedule) {
      throw new BadRequestException(
        'Appointment time is outside the doctor available schedule',
      );
    }

    // FIND EXISTING APPOINTMENTS

    const existing =
      await db.appointment.findMany({
        where: {
          doctorId,

          status: {
            in: ['SCHEDULED', 'CONFIRMED'],
          },

          scheduledAt: {
            gte: dayStart,
            lte: dayEnd,
          },

          ...(excludeAppointmentId
            ? {
                id: {
                  not: excludeAppointmentId,
                },
              }
            : {}),
        },

        select: {
          id: true,
          scheduledAt: true,
          duration: true,
        },
      });

    // CHECK DOUBLE BOOKING

    const overlaps = existing.some(
      (appointment) => {
        const existingStart =
          appointment.scheduledAt.getTime();

        const existingEnd =
          existingStart +
          appointment.duration * 60_000;

        return (
          start.getTime() < existingEnd &&
          end.getTime() > existingStart
        );
      },
    );

    if (overlaps) {
      throw new ConflictException(
        'Doctor already has an appointment during this time',
      );
    }

    // CHECK MAXIMUM APPOINTMENT LIMIT

    const matchingSchedule =
      doctor.schedules.find(
        (schedule) =>
          schedule.active &&
          schedule.dayOfWeek === start.getDay(),
      );

    if (
      matchingSchedule?.maxAppointments != null &&
      existing.length >=
        matchingSchedule.maxAppointments
    ) {
      throw new ConflictException(
        'Doctor has reached the maximum appointments for this schedule',
      );
    }
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class AppointmentScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async getDoctorAppointments(doctorId: number, date?: string) {
    const doctor = await this.prisma.doctor.findUnique({ where: { id: doctorId }, select: { id: true } });
    if (!doctor) throw new NotFoundException('Doctor not found');

    const where: { doctorId: number; scheduledAt?: { gte: Date; lt: Date } } = { doctorId };
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('Date must use YYYY-MM-DD');
      const [year, month, day] = date.split('-').map(Number);
      const start = new Date(year, month - 1, day);
      if (start.getFullYear() !== year || start.getMonth() !== month - 1 || start.getDate() !== day) {
        throw new BadRequestException('Invalid calendar date');
      }
      const end = new Date(year, month - 1, day + 1);
      where.scheduledAt = { gte: start, lt: end };
    }

    return this.prisma.appointment.findMany({
      where,
      include: { patient: true, doctor: true, department: true },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async getDailySchedule(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('Date must use YYYY-MM-DD');
    const [year, month, day] = date.split('-').map(Number);
    const start = new Date(year, month - 1, day);
    if (start.getFullYear() !== year || start.getMonth() !== month - 1 || start.getDate() !== day) {
      throw new BadRequestException('Invalid calendar date');
    }
    const end = new Date(year, month - 1, day + 1);
    return this.prisma.appointment.findMany({
      where: { scheduledAt: { gte: start, lt: end } },
      include: { patient: true, doctor: true, department: true },
      orderBy: [{ doctorId: 'asc' }, { scheduledAt: 'asc' }],
    });
  }

  async getAvailableSlots(doctorId: number, date: string, duration = 30) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('Date must use YYYY-MM-DD');
    if (!Number.isInteger(duration) || duration < 5 || duration > 480) {
      throw new BadRequestException('Appointment duration must be 5 to 480 minutes');
    }

    const [year, month, day] = date.split('-').map(Number);
    const startOfDay = new Date(year, month - 1, day);
    if (startOfDay.getFullYear() !== year || startOfDay.getMonth() !== month - 1 || startOfDay.getDate() !== day) {
      throw new BadRequestException('Invalid calendar date');
    }
    const endOfDay = new Date(year, month - 1, day + 1);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (startOfDay < today) throw new BadRequestException('Cannot check slots for past dates');

    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        schedules: { where: { active: true } },
        availability: true,
        leaves: true,
      },
    });
    if (!doctor) throw new NotFoundException('Doctor not found');
    if (!doctor.active) throw new BadRequestException('Doctor is inactive');

    // DoctorLeave and DoctorAvailability use @db.Date values; compare their UTC date keys.
    const dateKey = date;
    const approvedLeave = doctor.leaves.some((leave) => {
      const leaveStart = leave.startDate.toISOString().slice(0, 10);
      const leaveEnd = leave.endDate.toISOString().slice(0, 10);
      return leave.status === 'APPROVED' && dateKey >= leaveStart && dateKey <= leaveEnd;
    });
    if (approvedLeave) return [];

    const override = doctor.availability.find((item) => item.date.toISOString().slice(0, 10) === dateKey);
    if (override && ['UNAVAILABLE', 'CLOSED'].includes(String(override.status))) return [];

    const weeklySchedules = doctor.schedules.filter((schedule) => schedule.dayOfWeek === startOfDay.getDay());
    let ranges = weeklySchedules.map((schedule) => ({
      start: schedule.startTime,
      end: schedule.endTime,
      slotDuration: schedule.slotDurationMinutes,
    }));

    if (override) {
      const status = String(override.status);
      if (!['AVAILABLE', 'EXTRA_HOURS'].includes(status)) {
        throw new BadRequestException(`Unsupported doctor availability status: ${status}`);
      }
      if (override.startTime && override.endTime) {
        ranges = [{
          start: override.startTime,
          end: override.endTime,
          slotDuration: weeklySchedules[0]?.slotDurationMinutes ?? 15,
        }];
      }
      // AVAILABLE/EXTRA_HOURS without explicit times retain the active weekly ranges,
      // matching AppointmentBookingService.
    }

    if (ranges.length === 0) return [];

    const existing = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        scheduledAt: { gte: startOfDay, lt: endOfDay },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
      select: { scheduledAt: true, duration: true },
    });

    // Keep the daily cap consistent with AppointmentBookingService, which uses
    // the active weekly schedule matching this weekday.
    const matchingSchedule = weeklySchedules[0];
    if (matchingSchedule?.maxAppointments != null && existing.length >= matchingSchedule.maxAppointments) return [];

    const toMinutes = (value: string) => {
      const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
      if (!match) throw new BadRequestException(`Invalid schedule time: ${value}`);
      return Number(match[1]) * 60 + Number(match[2]);
    };

    const now = Date.now();
    const slots: Array<{ time: string; scheduledAt: string; available: true }> = [];
    const seen = new Set<number>();

    for (const range of ranges) {
      const rangeStart = toMinutes(range.start);
      const rangeEnd = toMinutes(range.end);
      const interval = range.slotDuration;
      if (rangeEnd <= rangeStart || !Number.isInteger(interval) || interval < 5) continue;

      for (let minute = rangeStart; minute + duration <= rangeEnd; minute += interval) {
        const hour = Math.floor(minute / 60);
        const min = minute % 60;
        const slotDate = new Date(year, month - 1, day, hour, min, 0, 0);
        const slotStart = slotDate.getTime();
        if (slotStart <= now || seen.has(slotStart)) continue;
        const slotEnd = slotStart + duration * 60_000;

        const overlaps = existing.some((appointment) => {
          const existingStart = appointment.scheduledAt.getTime();
          const existingEnd = existingStart + appointment.duration * 60_000;
          return slotStart < existingEnd && slotEnd > existingStart;
        });

        if (!overlaps) {
          seen.add(slotStart);
          slots.push({
            time: `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
            scheduledAt: slotDate.toISOString(),
            available: true,
          });
        }
      }
    }

    return slots.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  }
}

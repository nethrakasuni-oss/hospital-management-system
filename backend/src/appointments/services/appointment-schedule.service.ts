import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { BadRequestException } from '@nestjs/common';

@Injectable()
export class AppointmentScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async getDoctorAppointments(doctorId: number, date?: string) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { id: true },
    });
    if (!doctor) throw new NotFoundException('Doctor not found');

    const where: {
      doctorId: number;
      scheduledAt?: { gte: Date; lte: Date };
    } = { doctorId };

    if (date) {
      const start = new Date(`${date}T00:00:00`);
      if (Number.isNaN(start.getTime())) {
        throw new Error('Invalid date. Use YYYY-MM-DD.');
      }
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      where.scheduledAt = { gte: start, lte: end };
    }

    return this.prisma.appointment.findMany({
      where,
      include: { patient: true, doctor: true, department: true },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async getDailySchedule(date: string) {
    const start = new Date(`${date}T00:00:00`);
    if (Number.isNaN(start.getTime())) throw new Error('Invalid date. Use YYYY-MM-DD.');
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    return this.prisma.appointment.findMany({
      where: { scheduledAt: { gte: start, lte: end } },
      include: { patient: true, doctor: true, department: true },
      orderBy: [{ doctorId: 'asc' }, { scheduledAt: 'asc' }],
    });
  }

  
async getAvailableSlots(
  doctorId: number,
  date: string,
  duration = 30,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new BadRequestException('Date must use YYYY-MM-DD');
  }

  if (!Number.isInteger(duration) || duration < 5 || duration > 480) {
    throw new BadRequestException('Invalid appointment duration');
  }

  const [year, month, day] = date.split('-').map(Number);
  const startOfDay = new Date(year, month - 1, day);
  const endOfDay = new Date(year, month - 1, day + 1);

  if (
    startOfDay.getFullYear() !== year ||
    startOfDay.getMonth() !== month - 1 ||
    startOfDay.getDate() !== day
  ) {
    throw new BadRequestException('Invalid calendar date');
  }

  if (startOfDay.getTime() < new Date().setHours(0, 0, 0, 0)) {
    throw new BadRequestException('Cannot check slots for past dates');
  }

  const doctor = await this.prisma.doctor.findUnique({
    where: { id: doctorId },
    include: {
      schedules: { where: { active: true } },
      availability: true,
      leaves: true,
    },
  });

  if (!doctor) throw new NotFoundException('Doctor not found');

  if (!doctor.active) {
    throw new BadRequestException('Doctor is inactive');
  }

  const dateKey = date;
  const override = doctor.availability.find(
    item => item.date.toISOString().slice(0, 10) === dateKey
  );

  const approvedLeave = doctor.leaves.some(leave => {
    const leaveStart = leave.startDate.toISOString().slice(0, 10);
    const leaveEnd = leave.endDate.toISOString().slice(0, 10);

    return (
      leave.status === 'APPROVED' &&
      dateKey >= leaveStart &&
      dateKey <= leaveEnd
    );
  });

  if (approvedLeave) return [];

  if (
    override &&
    ['UNAVAILABLE', 'CLOSED'].includes(String(override.status))
  ) {
    return [];
  }

  const weeklySchedules = doctor.schedules.filter(
    schedule => schedule.dayOfWeek === startOfDay.getDay()
  );

  let ranges = weeklySchedules.map(schedule => ({
    start: schedule.startTime,
    end: schedule.endTime,
    slotDuration: schedule.slotDurationMinutes,
    maxAppointments: schedule.maxAppointments,
  }));

  if (
    override &&
    ['AVAILABLE', 'EXTRA_HOURS'].includes(String(override.status))
  ) {
    if (override.startTime && override.endTime) {
      ranges = [{
        start: override.startTime,
        end: override.endTime,
        slotDuration: weeklySchedules[0]?.slotDurationMinutes ?? 15,
        maxAppointments: weeklySchedules[0]?.maxAppointments ?? null,
      }];
    }
  }

  const existing = await this.prisma.appointment.findMany({
    where: {
      doctorId,
      scheduledAt: {
        gte: startOfDay,
        lt: endOfDay,
      },
      status: {
        in: ['SCHEDULED', 'CONFIRMED'],
      },
    },
    select: {
      scheduledAt: true,
      duration: true,
    },
  });

  const totalLimit = ranges.find(
    range => range.maxAppointments != null
  )?.maxAppointments;

  if (totalLimit != null && existing.length >= totalLimit) {
    return [];
  }

  const now = Date.now();
  const slots: Array<{
    time: string;
    scheduledAt: string;
    available: boolean;
  }> = [];

  const toMinutes = (time: string) => {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
    if (!match) throw new BadRequestException('Invalid schedule time');

    return Number(match[1]) * 60 + Number(match[2]);
  };

  for (const range of ranges) {
    const rangeStart = toMinutes(range.start);
    const rangeEnd = toMinutes(range.end);
    const interval = range.slotDuration;

    if (
      rangeEnd <= rangeStart ||
      !Number.isInteger(interval) ||
      interval < 5
    ) continue;

    for (
      let minute = rangeStart;
      minute + duration <= rangeEnd;
      minute += interval
    ) {
      const hour = Math.floor(minute / 60);
      const min = minute % 60;

      const slotDate = new Date(
        year, month - 1, day, hour, min, 0, 0
      );

      if (slotDate.getTime() <= now) continue;

      const slotEnd = slotDate.getTime() + duration * 60000;

      const occupied = existing.some(appointment => {
        const existingStart = appointment.scheduledAt.getTime();
        const existingEnd =
          existingStart + appointment.duration * 60000;

        return (
          slotDate.getTime() < existingEnd &&
          slotEnd > existingStart
        );
      });

      if (!occupied) {
        slots.push({
          time: `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
          scheduledAt: slotDate.toISOString(),
          available: true,
        });
      }
    }
  }

  return slots;
}

}

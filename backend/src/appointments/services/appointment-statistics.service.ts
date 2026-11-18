import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class AppointmentStatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(from?: string, to?: string) {
    const scheduledAt: { gte?: Date; lte?: Date } = {};
    if (from) scheduledAt.gte = new Date(from);
    if (to) scheduledAt.lte = new Date(to);

    const where = from || to ? { scheduledAt } : undefined;
    const [
      total,
      scheduled,
      confirmed,
      completed,
      cancelled,
      noShow,
      revenue,
    ] = await this.prisma.$transaction([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.count({ where: { ...where, status: 'SCHEDULED' } }),
      this.prisma.appointment.count({ where: { ...where, status: 'CONFIRMED' } }),
      this.prisma.appointment.count({ where: { ...where, status: 'COMPLETED' } }),
      this.prisma.appointment.count({ where: { ...where, status: 'CANCELLED' } }),
      this.prisma.appointment.count({ where: { ...where, status: 'NO_SHOW' } }),
      this.prisma.appointment.aggregate({
        where: { ...where, status: 'COMPLETED' },
        _sum: { consultationFee: true },
      }),
    ]);

    return {
      total,
      scheduled,
      confirmed,
      completed,
      cancelled,
      noShow,
      completedConsultationFees: revenue._sum.consultationFee ?? 0,
    };
  }

  async getDoctorStatistics(doctorId: number, from?: string, to?: string) {
    const where: {
      doctorId: number;
      scheduledAt?: { gte?: Date; lte?: Date };
    } = { doctorId };
    if (from || to) {
      where.scheduledAt = {};
      if (from) where.scheduledAt.gte = new Date(from);
      if (to) where.scheduledAt.lte = new Date(to);
    }

    const [total, completed, cancelled, noShow, fees] =
      await this.prisma.$transaction([
        this.prisma.appointment.count({ where }),
        this.prisma.appointment.count({ where: { ...where, status: 'COMPLETED' } }),
        this.prisma.appointment.count({ where: { ...where, status: 'CANCELLED' } }),
        this.prisma.appointment.count({ where: { ...where, status: 'NO_SHOW' } }),
        this.prisma.appointment.aggregate({
          where: { ...where, status: 'COMPLETED' },
          _sum: { consultationFee: true },
        }),
      ]);

    return {
      doctorId,
      total,
      completed,
      cancelled,
      noShow,
      completedConsultationFees: fees._sum.consultationFee ?? 0,
    };
  }
}

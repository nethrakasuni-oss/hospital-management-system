import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
@Injectable()
export class AttendanceStatisticsService {
  constructor(private readonly prisma: PrismaService) {}
  async overview(from?: string, to?: string) {
    const date: {gte?: Date; lte?: Date} = {};
    if (from) date.gte = new Date(`${from}T00:00:00`);
    if (to) date.lte = new Date(`${to}T23:59:59.999`);
    if ((from && Number.isNaN(date.gte!.getTime())) || (to && Number.isNaN(date.lte!.getTime()))) throw new BadRequestException('Invalid date range');
    const where = from || to ? { date } : {};
    const [total,present,absent,halfDay,onLeave,late,working] = await this.prisma.$transaction([
      this.prisma.attendance.count({ where }),
      this.prisma.attendance.count({ where: { ...where, status:'PRESENT' } }),
      this.prisma.attendance.count({ where: { ...where, status:'ABSENT' } }),
      this.prisma.attendance.count({ where: { ...where, status:'HALF_DAY' } }),
      this.prisma.attendance.count({ where: { ...where, status:'ON_LEAVE' } }),
      this.prisma.attendance.count({ where: { ...where, lateMinutes: { gt:0 } } }),
      this.prisma.attendance.aggregate({ where, _sum: { workingMinutes:true } }),
    ]);
    return { totalRecords:total, present, absent, halfDay, onLeave, lateRecords:late, totalWorkingMinutes:working._sum.workingMinutes ?? 0 };
  }
  async employee(employeeId: number, month?: string) {
    let date: {gte?: Date; lte?: Date} | undefined;
    if (month) {
      if (!/^\\d{4}-\\d{2}$/.test(month)) throw new BadRequestException('Month must use YYYY-MM');
      const [y,m] = month.split('-').map(Number); if (m<1 || m>12) throw new BadRequestException('Invalid month');
      date = { gte:new Date(y,m-1,1), lte:new Date(y,m,0,23,59,59,999) };
    }
    const where = { employeeId, ...(date ? { date } : {}) };
    const [total,present,absent,late,working] = await this.prisma.$transaction([
      this.prisma.attendance.count({ where }),
      this.prisma.attendance.count({ where: { ...where, status:'PRESENT' } }),
      this.prisma.attendance.count({ where: { ...where, status:'ABSENT' } }),
      this.prisma.attendance.count({ where: { ...where, lateMinutes:{gt:0} } }),
      this.prisma.attendance.aggregate({ where, _sum:{workingMinutes:true} }),
    ]);
    return { employeeId, totalRecords:total, present, absent, lateRecords:late, totalWorkingMinutes:working._sum.workingMinutes ?? 0 };
  }
}

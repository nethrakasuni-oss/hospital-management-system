import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
@Injectable()
export class AttendanceReportService {
  constructor(private readonly prisma: PrismaService) {}
  private monthRange(month: string) {
    if (!/^\\d{4}-\\d{2}$/.test(month)) throw new BadRequestException('Month must use YYYY-MM format');
    const [y,m] = month.split('-').map(Number); if (m<1 || m>12) throw new BadRequestException('Invalid month');
    return { gte: new Date(y,m-1,1), lte: new Date(y,m,0,23,59,59,999) };
  }
  async daily(date: string) {
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) throw new BadRequestException('Date must use YYYY-MM-DD format');
    const [y,m,d] = date.split('-').map(Number); const start = new Date(y,m-1,d);
    if (start.getFullYear()!==y || start.getMonth()!==m-1 || start.getDate()!==d) throw new BadRequestException('Invalid date');
    return this.prisma.attendance.findMany({ where: { date: start }, include: { employee: { include: { user: true, department: true } } }, orderBy: { employeeId:'asc' } });
  }
  monthly(month: string, employeeId?: number) {
    return this.prisma.attendance.findMany({ where: { date: this.monthRange(month), ...(employeeId ? { employeeId } : {}) }, include: { employee: true }, orderBy: [{ employeeId:'asc' },{ date:'asc' }] });
  }
}

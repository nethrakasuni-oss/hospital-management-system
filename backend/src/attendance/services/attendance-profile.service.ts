import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UpdateAttendanceDto } from '../dto/update-attendance.dto.js';
@Injectable()
export class AttendanceProfileService {
  constructor(private readonly prisma: PrismaService) {}
  parseDate(value: string) {
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) throw new BadRequestException('Date must use YYYY-MM-DD format');
    const [y,m,d] = value.split('-').map(Number); const date = new Date(y,m-1,d);
    if (date.getFullYear()!==y || date.getMonth()!==m-1 || date.getDate()!==d) throw new BadRequestException('Invalid calendar date');
    return date;
  }
  async findAll(date?: string) {
    return this.prisma.attendance.findMany({ where: date ? { date: this.parseDate(date) } : {}, include: { employee: { include: { user: true, department: true } } }, orderBy: [{ date:'desc' },{ employeeId:'asc' }] });
  }
  async findOne(id: number) {
    const item = await this.prisma.attendance.findUnique({ where: { id }, include: { employee: true } });
    if (!item) throw new NotFoundException('Attendance record not found'); return item;
  }
  async findEmployeeHistory(employeeId: number, from?: string, to?: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');
    const date: {gte?: Date; lte?: Date} = {};
    if (from) date.gte = this.parseDate(from); if (to) date.lte = this.parseDate(to);
    if (from && to && date.gte! > date.lte!) throw new BadRequestException('"from" must be before "to"');
    return this.prisma.attendance.findMany({ where: { employeeId, ...(from || to ? { date } : {}) }, orderBy: { date:'desc' } });
  }
  async update(id: number, dto: UpdateAttendanceDto) {
    const current = await this.findOne(id);
    const checkIn = dto.checkIn === undefined ? current.checkIn : dto.checkIn === null ? null : new Date(dto.checkIn);
    const checkOut = dto.checkOut === undefined ? current.checkOut : dto.checkOut === null ? null : new Date(dto.checkOut);
    if (checkIn && Number.isNaN(checkIn.getTime())) throw new BadRequestException('Invalid check-in');
    if (checkOut && Number.isNaN(checkOut.getTime())) throw new BadRequestException('Invalid check-out');
    if (checkIn && checkOut && checkOut <= checkIn) throw new BadRequestException('Check-out must be later than check-in');
    const breaks = dto.breakDurationMinutes ?? current.breakDurationMinutes;
    const workingMinutes = checkIn && checkOut ? Math.max(0, Math.floor((checkOut.getTime()-checkIn.getTime())/60000)-breaks) : 0;
    const lateMinutes = checkIn ? Math.max(0, checkIn.getHours()*60+checkIn.getMinutes()-480) : 0;
    const earlyDepartureMinutes = checkOut ? Math.max(0, 1020-(checkOut.getHours()*60+checkOut.getMinutes())) : 0;
    return this.prisma.attendance.update({ where: { id }, data: { checkIn, checkOut, breakDurationMinutes: breaks, workingMinutes, lateMinutes, earlyDepartureMinutes, ...(dto.status ? { status: dto.status } : {}), ...(dto.notes !== undefined ? { notes: dto.notes } : {}) }, include: { employee: true } });
  }
}

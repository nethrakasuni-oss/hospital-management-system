import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CheckOutDto } from '../dto/check-out.dto.js';
@Injectable()
export class AttendanceCheckOutService {
  constructor(private readonly prisma: PrismaService) {}
  async checkOut(dto: CheckOutDto) {
    const now = new Date(); const date = new Date(now); date.setHours(0,0,0,0);
    const record = await this.prisma.attendance.findUnique({ where: { employeeId_date: { employeeId: dto.employeeId, date } } });
    if (!record) throw new NotFoundException('No check-in record found for today');
    if (!record.checkIn) throw new BadRequestException('Employee has not checked in');
    if (record.checkOut) throw new BadRequestException('Employee has already checked out');
    if (now <= record.checkIn) throw new BadRequestException('Check-out must be later than check-in');
    const breakMinutes = dto.breakDurationMinutes ?? record.breakDurationMinutes;
    if (breakMinutes < 0) throw new BadRequestException('Break duration cannot be negative');
    const workingMinutes = Math.max(0, Math.floor((now.getTime()-record.checkIn.getTime())/60000)-breakMinutes);
    const earlyDepartureMinutes = Math.max(0, 1020-(now.getHours()*60+now.getMinutes()));
    return this.prisma.attendance.update({ where: { id: record.id }, data: { checkOut: now, breakDurationMinutes: breakMinutes, workingMinutes, earlyDepartureMinutes, ...(dto.notes !== undefined ? { notes: dto.notes } : {}) }, include: { employee: true } });
  }
}

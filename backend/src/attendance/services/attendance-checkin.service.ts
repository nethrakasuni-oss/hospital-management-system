import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CheckInDto } from '../dto/check-in.dto.js';
@Injectable()
export class AttendanceCheckInService {
  constructor(private readonly prisma: PrismaService) {}
  async checkIn(dto: CheckInDto) {
    const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId }, select: { id: true, isActive: true } });
    if (!employee) throw new NotFoundException('Employee not found');
    if (!employee.isActive) throw new BadRequestException('Employee is not active');
    const now = new Date(); const date = new Date(now); date.setHours(0,0,0,0);
    const leave = await this.prisma.leaveRecord.findFirst({ where: { employeeId: dto.employeeId, status: 'APPROVED', startDate: { lte: now }, endDate: { gte: date } } });
    if (leave) throw new BadRequestException('Employee has approved leave today');
    const lateMinutes = Math.max(0, now.getHours()*60 + now.getMinutes() - 480);
    try {
      return await this.prisma.attendance.create({ data: { employeeId: dto.employeeId, date, checkIn: now, status: 'PRESENT', lateMinutes, notes: dto.notes?.trim() || null }, include: { employee: true } });
    } catch (error) { if ((error as {code?: string}).code === 'P2002') throw new ConflictException('Attendance already exists for this employee today'); throw error; }
  }
}

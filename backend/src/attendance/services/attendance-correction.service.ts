import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AttendanceCorrectionDto } from '../dto/attendance-correction.dto.js';
import { ReviewCorrectionDto } from '../dto/review-correction.dto.js';
@Injectable()
export class AttendanceCorrectionService {
  constructor(private readonly prisma: PrismaService) {}
  private dateOnly(v: string) {
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(v)) throw new BadRequestException('Date must use YYYY-MM-DD format');
    const [y,m,d] = v.split('-').map(Number); const date = new Date(y,m-1,d);
    if (date.getFullYear()!==y || date.getMonth()!==m-1 || date.getDate()!==d) throw new BadRequestException('Invalid date');
    return date;
  }
  async create(employeeId: number, dto: AttendanceCorrectionDto) {
    if (!await this.prisma.employee.findUnique({ where: { id: employeeId } })) throw new NotFoundException('Employee not found');
    const requestedDate = this.dateOnly(dto.requestedDate);
    const requestedCheckIn = dto.requestedCheckIn ? new Date(dto.requestedCheckIn) : null;
    const requestedCheckOut = dto.requestedCheckOut ? new Date(dto.requestedCheckOut) : null;
    if (!requestedCheckIn && !requestedCheckOut) throw new BadRequestException('Provide requested check-in or check-out');
    if (requestedCheckIn && requestedCheckOut && requestedCheckOut <= requestedCheckIn) throw new BadRequestException('Check-out must be later than check-in');
    return this.prisma.attendanceCorrection.create({ data: { employeeId, requestedDate, requestedCheckIn, requestedCheckOut, reason: dto.reason.trim() }, include: { employee:true, attendance:true } });
  }
  findMine(employeeId: number) { return this.prisma.attendanceCorrection.findMany({ where: { employeeId }, include: { attendance:true }, orderBy: { createdAt:'desc' } }); }
  findPending() { return this.prisma.attendanceCorrection.findMany({ where: { status:'PENDING' }, include: { employee:true, attendance:true }, orderBy: { createdAt:'asc' } }); }
  async review(id: number, reviewerId: number, dto: ReviewCorrectionDto) {
    const correction = await this.prisma.attendanceCorrection.findUnique({ where: { id } });
    if (!correction) throw new NotFoundException('Correction request not found');
    if (correction.status !== 'PENDING') throw new BadRequestException('Correction request already reviewed');
    return this.prisma.$transaction(async tx => {
      let attendanceId = correction.attendanceId;
      if (dto.status === 'APPROVED') {
        const existing = await tx.attendance.findUnique({ where: { employeeId_date: { employeeId: correction.employeeId, date: correction.requestedDate } } });
        const checkIn = correction.requestedCheckIn ?? existing?.checkIn ?? null;
        const checkOut = correction.requestedCheckOut ?? existing?.checkOut ?? null;
        if (checkIn && checkOut && checkOut <= checkIn) throw new BadRequestException('Corrected checkout must be later than checkin');
        const workingMinutes = checkIn && checkOut ? Math.max(0, Math.floor((checkOut.getTime()-checkIn.getTime())/60000)) : 0;
        const attendance = await tx.attendance.upsert({
          where: { employeeId_date: { employeeId: correction.employeeId, date: correction.requestedDate } },
          create: { employeeId: correction.employeeId, date: correction.requestedDate, checkIn, checkOut, workingMinutes, status:'PRESENT' },
          update: { checkIn, checkOut, workingMinutes, status:'PRESENT' },
        });
        attendanceId = attendance.id;
      }
      return tx.attendanceCorrection.update({ where: { id }, data: { status: dto.status, reviewNotes: dto.reviewNotes ?? null, reviewedById: reviewerId, reviewedAt: new Date(), attendanceId }, include: { employee:true, attendance:true } });
    });
  }
}

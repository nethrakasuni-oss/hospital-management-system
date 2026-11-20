import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateLeaveDto } from '../dto/create-leave.dto.js';
import { ReviewLeaveDto } from '../dto/review-leave.dto.js';

@Injectable()
export class LeaveService {
  constructor(private readonly prisma: PrismaService) {}

  private dateOnly(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid leave date');
    return date;
  }

  async create(dto: CreateLeaveDto, actorUserId: number) {
    const startDate = this.dateOnly(dto.startDate);
    const endDate = this.dateOnly(dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('Leave end date cannot be earlier than the start date');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
      include: { user: { select: { id: true } } },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    if (!employee.isActive) throw new BadRequestException('Inactive employees cannot apply for leave');

    const overlap = await this.prisma.leaveRecord.findFirst({
      where: {
        employeeId: dto.employeeId,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { id: true },
    });
    if (overlap) {
      throw new ConflictException('This employee already has overlapping leave for the selected dates');
    }

    const record = await this.prisma.leaveRecord.create({
      data: {
        employeeId: dto.employeeId,
        startDate,
        endDate,
        leaveType: dto.leaveType?.trim() || null,
        reason: dto.reason?.trim() || null,
      },
      include: { employee: { include: { user: true, department: true } } },
    });
    await this.prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'LeaveRecord',
        entityId: String(record.id),
        userId: actorUserId,
        newData: { employeeId: dto.employeeId, startDate: dto.startDate, endDate: dto.endDate },
      },
    });
    return record;
  }

  findAll(status?: string) {
    return this.prisma.leaveRecord.findMany({
      where: status ? { status: status as never } : {},
      include: {
        employee: { include: { user: true, department: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findEmployee(employeeId: number) {
    return this.prisma.leaveRecord.findMany({
      where: { employeeId },
      include: {
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async review(id: number, reviewerId: number, dto: ReviewLeaveDto) {
    const record = await this.prisma.leaveRecord.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Leave record not found');
    if (record.status !== 'PENDING') {
      throw new BadRequestException('Only pending leave requests can be reviewed');
    }

    const updated = await this.prisma.leaveRecord.update({
      where: { id },
      data: {
        status: dto.status,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewNotes: dto.reviewNotes?.trim() || null,
      },
      include: {
        employee: { include: { user: true, department: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    await this.prisma.auditLog.create({
      data: {
        action: dto.status === 'APPROVED' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
        entity: 'LeaveRecord',
        entityId: String(id),
        userId: reviewerId,
        newData: { status: dto.status, reviewNotes: dto.reviewNotes?.trim() || null },
      },
    });
    return updated;
  }
}

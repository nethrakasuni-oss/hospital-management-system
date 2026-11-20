import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { CreateNursingAssignmentDto } from '../dto/create-nursing-assignment.dto.js';
import { UpdateNursingAssignmentDto } from '../dto/update-nursing-assignment.dto.js';

@Injectable()
export class NursingAssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(employeeId: number, dto: CreateNursingAssignmentDto) {
    const patient = await this.prisma.patient.findUnique({ where: { id: dto.patientId }, select: { id: true } });
    if (!patient) throw new NotFoundException('Patient not found');

    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId ?? employeeId },
      include: { user: { include: { role: true } } },
    });
    if (!employee) throw new NotFoundException('Nursing employee not found');
    if (!employee.isActive) throw new BadRequestException('Employee is inactive');
    if (employee.user.role.name !== 'NURSE') throw new BadRequestException('Selected employee is not a nurse');

    if (dto.admissionId) {
      const admission = await this.prisma.admission.findUnique({
        where: { id: dto.admissionId },
        select: { id: true, patientId: true, status: true },
      });
      if (!admission) throw new NotFoundException('Admission not found');
      if (admission.status !== 'ADMITTED') throw new BadRequestException('Admission is not active');
      if (admission.patientId !== dto.patientId) throw new BadRequestException('Admission does not belong to this patient');
    }

    const assignedAt = dto.assignedAt ? new Date(dto.assignedAt) : new Date();
    if (Number.isNaN(assignedAt.getTime())) throw new BadRequestException('Invalid assignedAt date');

    try {
      return await this.prisma.$transaction(async tx => {
        const duplicate = await tx.nursingAssignment.findFirst({
          where: { patientId: dto.patientId, employeeId: employee.id, active: true },
          select: { id: true },
        });
        if (duplicate) throw new ConflictException('This nurse already has an active assignment for the patient');
        return tx.nursingAssignment.create({
          data: {
            patientId: dto.patientId,
            employeeId: employee.id,
            admissionId: dto.admissionId ?? null,
            assignedAt,
            shift: dto.shift?.trim() || null,
            notes: dto.notes?.trim() || null,
          },
          include: { patient: true, employee: { include: { user: true, department: true } }, admission: true },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'P2034') throw new ConflictException('Assignment conflicted with another request. Please retry.');
      if (code === 'P2003') throw new BadRequestException('Invalid patient, employee or admission reference');
      throw error;
    }
  }

  async findAll(filters: { patientId?: number; employeeId?: number; admissionId?: number; active?: boolean }) {
    return this.prisma.nursingAssignment.findMany({
      where: {
        ...(filters.patientId ? { patientId: filters.patientId } : {}),
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
        ...(filters.admissionId ? { admissionId: filters.admissionId } : {}),
        ...(filters.active !== undefined ? { active: filters.active } : {}),
      },
      include: {
        patient: true,
        employee: { include: { user: true, department: true } },
        admission: { include: { bed: { include: { room: { include: { ward: true } } } } } },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const item = await this.prisma.nursingAssignment.findUnique({
      where: { id },
      include: {
        patient: true,
        employee: { include: { user: true, department: true } },
        admission: { include: { bed: { include: { room: { include: { ward: true } } } } } },
      },
    });
    if (!item) throw new NotFoundException('Nursing assignment not found');
    return item;
  }

  async update(id: number, dto: UpdateNursingAssignmentDto) {
    const current = await this.findOne(id);
    const assignedAt = dto.assignedAt ? new Date(dto.assignedAt) : current.assignedAt;
    const endedAt = dto.endedAt === undefined ? current.endedAt : dto.endedAt === null ? null : new Date(dto.endedAt);
    if (Number.isNaN(assignedAt.getTime()) || (endedAt && Number.isNaN(endedAt.getTime()))) throw new BadRequestException('Invalid assignment date');
    if (endedAt && endedAt < assignedAt) throw new BadRequestException('endedAt cannot be earlier than assignedAt');
    const active = dto.active ?? current.active;
    if (active && endedAt) throw new BadRequestException('An active assignment cannot have endedAt');
    if (!current.active && active) {
      const duplicate = await this.prisma.nursingAssignment.findFirst({
        where: { patientId: current.patientId, employeeId: current.employeeId, active: true, NOT: { id } },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException('This nurse already has an active assignment for the patient');
    }
    return this.prisma.nursingAssignment.update({
      where: { id },
      data: {
        ...(dto.assignedAt !== undefined ? { assignedAt } : {}),
        ...(dto.endedAt !== undefined ? { endedAt } : {}),
        ...(dto.shift !== undefined ? { shift: dto.shift?.trim() || null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
      include: { patient: true, employee: { include: { user: true, department: true } }, admission: true },
    });
  }

  async end(id: number) {
    const current = await this.findOne(id);
    if (!current.active) throw new ConflictException('Assignment is already ended');
    return this.prisma.nursingAssignment.update({
      where: { id },
      data: { active: false, endedAt: new Date() },
      include: { patient: true, employee: { include: { user: true } }, admission: true },
    });
  }
}

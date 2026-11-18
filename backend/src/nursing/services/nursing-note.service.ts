import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateNursingNoteDto } from '../dto/create-nursing-note.dto.js';
import { UpdateNursingNoteDto } from '../dto/update-nursing-note.dto.js';

@Injectable()
export class NursingNoteService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, employeeId: number | null, dto: CreateNursingNoteDto) {
    const patient = await this.prisma.patient.findUnique({ where: { id: dto.patientId }, select: { id: true } });
    if (!patient) throw new NotFoundException('Patient not found');
    if (dto.assignmentId) {
      const assignment = await this.prisma.nursingAssignment.findUnique({ where: { id: dto.assignmentId }, select: { id: true, patientId: true, active: true } });
      if (!assignment) throw new NotFoundException('Nursing assignment not found');
      if (assignment.patientId !== dto.patientId) throw new BadRequestException('Assignment does not belong to this patient');
      if (!assignment.active) throw new BadRequestException('Cannot add a note to an inactive assignment');
    }
    const recordedAt = dto.recordedAt ? new Date(dto.recordedAt) : new Date();
    if (Number.isNaN(recordedAt.getTime())) throw new BadRequestException('Invalid recordedAt date');
    return this.prisma.nursingNote.create({
      data: {
        patientId: dto.patientId,
        employeeId,
        authorUserId: userId,
        assignmentId: dto.assignmentId ?? null,
        noteType: dto.noteType?.trim() || 'GENERAL',
        content: dto.content.trim(),
        recordedAt,
      },
      include: { patient: true, employee: { include: { user: true } }, assignment: true, author: true },
    });
  }

  async findByPatient(patientId: number) {
    if (!await this.prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } })) throw new NotFoundException('Patient not found');
    return this.prisma.nursingNote.findMany({
      where: { patientId },
      include: { employee: { include: { user: true } }, assignment: true, author: true },
      orderBy: { recordedAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const note = await this.prisma.nursingNote.findUnique({
      where: { id },
      include: { patient: true, employee: { include: { user: true } }, assignment: true, author: true },
    });
    if (!note) throw new NotFoundException('Nursing note not found');
    return note;
  }

  async update(id: number, dto: UpdateNursingNoteDto) {
    await this.findOne(id);
    const recordedAt = dto.recordedAt ? new Date(dto.recordedAt) : undefined;
    if (recordedAt && Number.isNaN(recordedAt.getTime())) throw new BadRequestException('Invalid recordedAt date');
    return this.prisma.nursingNote.update({
      where: { id },
      data: {
        ...(dto.noteType !== undefined ? { noteType: dto.noteType.trim() } : {}),
        ...(dto.content !== undefined ? { content: dto.content.trim() } : {}),
        ...(recordedAt ? { recordedAt } : {}),
      },
      include: { patient: true, employee: { include: { user: true } }, assignment: true, author: true },
    });
  }
}

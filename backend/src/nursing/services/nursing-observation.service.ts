import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateNursingObservationDto } from '../dto/create-nursing-observation.dto.js';

@Injectable()
export class NursingObservationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(employeeId: number | null, dto: CreateNursingObservationDto) {
    if (!await this.prisma.patient.findUnique({ where: { id: dto.patientId }, select: { id: true } })) throw new NotFoundException('Patient not found');
    if (dto.assignmentId) {
      const assignment = await this.prisma.nursingAssignment.findUnique({ where: { id: dto.assignmentId }, select: { id: true, patientId: true, active: true } });
      if (!assignment) throw new NotFoundException('Nursing assignment not found');
      if (assignment.patientId !== dto.patientId) throw new BadRequestException('Assignment does not belong to this patient');
      if (!assignment.active) throw new BadRequestException('Cannot record observations against an inactive assignment');
    }
    const observedAt = dto.observedAt ? new Date(dto.observedAt) : new Date();
    if (Number.isNaN(observedAt.getTime())) throw new BadRequestException('Invalid observedAt date');
    if (dto.systolicBP !== undefined && dto.diastolicBP !== undefined && dto.systolicBP <= dto.diastolicBP) {
      throw new BadRequestException('Systolic blood pressure must be greater than diastolic blood pressure');
    }
    return this.prisma.nursingObservation.create({
      data: {
        patientId: dto.patientId,
        employeeId,
        assignmentId: dto.assignmentId ?? null,
        observedAt,
        ...(dto.temperatureC !== undefined ? { temperatureC: new Prisma.Decimal(dto.temperatureC) } : {}),
        ...(dto.systolicBP !== undefined ? { systolicBP: dto.systolicBP } : {}),
        ...(dto.diastolicBP !== undefined ? { diastolicBP: dto.diastolicBP } : {}),
        ...(dto.pulseBpm !== undefined ? { pulseBpm: dto.pulseBpm } : {}),
        ...(dto.respiratoryRate !== undefined ? { respiratoryRate: dto.respiratoryRate } : {}),
        ...(dto.oxygenSaturation !== undefined ? { oxygenSaturation: new Prisma.Decimal(dto.oxygenSaturation) } : {}),
        ...(dto.bloodGlucose !== undefined ? { bloodGlucose: new Prisma.Decimal(dto.bloodGlucose) } : {}),
        ...(dto.weightKg !== undefined ? { weightKg: new Prisma.Decimal(dto.weightKg) } : {}),
        ...(dto.heightCm !== undefined ? { heightCm: new Prisma.Decimal(dto.heightCm) } : {}),
        ...(dto.painScore !== undefined ? { painScore: dto.painScore } : {}),
        notes: dto.notes?.trim() || null,
      },
      include: { patient: true, employee: { include: { user: true } }, assignment: true },
    });
  }

  async findByPatient(patientId: number, from?: string, to?: string) {
    if (!await this.prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } })) throw new NotFoundException('Patient not found');
    const observedAt: { gte?: Date; lte?: Date } = {};
    if (from) { observedAt.gte = new Date(from); if (Number.isNaN(observedAt.gte.getTime())) throw new BadRequestException('Invalid from date'); }
    if (to) { observedAt.lte = new Date(to); if (Number.isNaN(observedAt.lte.getTime())) throw new BadRequestException('Invalid to date'); }
    if (observedAt.gte && observedAt.lte && observedAt.gte > observedAt.lte) throw new BadRequestException('from must be earlier than to');
    return this.prisma.nursingObservation.findMany({
      where: { patientId, ...(from || to ? { observedAt } : {}) },
      include: { employee: { include: { user: true } }, assignment: true },
      orderBy: { observedAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const observation = await this.prisma.nursingObservation.findUnique({
      where: { id },
      include: { patient: true, employee: { include: { user: true } }, assignment: true },
    });
    if (!observation) throw new NotFoundException('Nursing observation not found');
    return observation;
  }
}

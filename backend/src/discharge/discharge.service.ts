import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDischargeSummaryDto } from './dto/create-discharge-summary.dto.js';
import { UpdateDischargeSummaryDto } from './dto/update-discharge-summary.dto.js';

@Injectable()
export class DischargeService {
  constructor(private readonly prisma: PrismaService) {}
  private number() { return `DS-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`; }

  async create(dto: CreateDischargeSummaryDto, userId: number) {
    const admission = await this.prisma.admission.findUnique({ where: { id: dto.admissionId }, include: { patient: true, bed: true } });
    if (!admission) throw new NotFoundException('Admission not found');
    if (admission.patientId !== dto.patientId) throw new BadRequestException('Admission does not belong to this patient');
    if (admission.status !== 'ADMITTED') throw new BadRequestException('Only currently admitted patients can be discharged');
    const existing = await this.prisma.dischargeSummary.findUnique({ where: { admissionId: dto.admissionId } });
    if (existing) throw new ConflictException('A discharge summary already exists for this admission');
    const dischargeDate = dto.dischargeDate ? new Date(dto.dischargeDate) : new Date();
    if (dischargeDate < new Date(dto.admissionDate)) throw new BadRequestException('Discharge date cannot be earlier than admission date');

    return this.prisma.$transaction(async (tx) => {
      const summary = await tx.dischargeSummary.create({
        data: { summaryNumber: this.number(), patientId: dto.patientId, admissionId: dto.admissionId,
          admissionDate: new Date(dto.admissionDate), dischargeDate, principalDiagnosis: dto.principalDiagnosis,
          treatmentSummary: dto.treatmentSummary, preparedById: userId,
          ...(dto.secondaryDiagnoses !== undefined ? { secondaryDiagnoses: dto.secondaryDiagnoses } : {}),
          ...(dto.proceduresPerformed !== undefined ? { proceduresPerformed: dto.proceduresPerformed } : {}),
          ...(dto.dischargeMedication !== undefined ? { dischargeMedication: dto.dischargeMedication } : {}),
          ...(dto.followUpInstructions !== undefined ? { followUpInstructions: dto.followUpInstructions } : {}),
          ...(dto.conditionAtDischarge !== undefined ? { conditionAtDischarge: dto.conditionAtDischarge } : {}) },
        include: { patient: true, admission: true, preparedBy: true },
      });
      await tx.admission.update({ where: { id: dto.admissionId }, data: { status: 'DISCHARGED', dischargeDate } });
      if (admission.bedId) await tx.bed.updateMany({ where: { id: admission.bedId }, data: { status: 'AVAILABLE' } });
      return summary;
    });
  }

  findAll(patientId?: number, from?: string, to?: string) {
    return this.prisma.dischargeSummary.findMany({
      where: { ...(patientId ? { patientId } : {}), ...(from || to ? { dischargeDate: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}) },
      include: { patient: true, admission: true, preparedBy: true }, orderBy: { dischargeDate: 'desc' },
    });
  }

  async findOne(id: number) {
    const row = await this.prisma.dischargeSummary.findUnique({ where: { id }, include: { patient: true, admission: true, preparedBy: true } });
    if (!row) throw new NotFoundException('Discharge summary not found');
    return row;
  }

  async update(id: number, dto: UpdateDischargeSummaryDto) {
    await this.findOne(id);
    return this.prisma.dischargeSummary.update({ where: { id }, data: dto, include: { patient: true, admission: true, preparedBy: true } });
  }

  async byAdmission(admissionId: number) {
    const row = await this.prisma.dischargeSummary.findUnique({ where: { admissionId }, include: { patient: true, admission: true, preparedBy: true } });
    if (!row) throw new NotFoundException('Discharge summary not found for this admission');
    return row;
  }
}

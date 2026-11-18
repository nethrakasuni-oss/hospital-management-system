import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateEmergencyVisitDto } from './dto/create-emergency-visit.dto.js';
import { UpdateEmergencyVisitDto } from './dto/update-emergency-visit.dto.js';

@Injectable()
export class EmergencyService {
  constructor(private readonly prisma: PrismaService) {}

  private number(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
  }

  async create(dto: CreateEmergencyVisitDto, userId: number) {
    await this.prisma.patient.findUniqueOrThrow({ where: { id: dto.patientId }, select: { id: true } })
      .catch(() => { throw new NotFoundException('Patient not found'); });
    if (dto.admissionId) await this.prisma.admission.findUniqueOrThrow({ where: { id: dto.admissionId } })
      .catch(() => { throw new NotFoundException('Admission not found'); });
    if (dto.attendingDoctorId) await this.prisma.doctor.findUniqueOrThrow({ where: { id: dto.attendingDoctorId } })
      .catch(() => { throw new NotFoundException('Doctor not found'); });

    return this.prisma.emergencyVisit.create({
      data: {
        visitNumber: this.number('ER'),
        patientId: dto.patientId,
        triageLevel: dto.triageLevel as never,
        chiefComplaint: dto.chiefComplaint,
        ...(dto.clinicalNotes !== undefined ? { clinicalNotes: dto.clinicalNotes } : {}),
        ...(dto.vitalSigns !== undefined ? { vitalSigns: dto.vitalSigns as never } : {}),
        ...(dto.admissionId ? { admissionId: dto.admissionId } : {}),
        ...(dto.attendingDoctorId ? { attendingDoctorId: dto.attendingDoctorId } : {}),
        ...(dto.arrivalAt ? { arrivalAt: new Date(dto.arrivalAt) } : {}),
        createdById: userId,
      },
      include: { patient: true, attendingDoctor: { include: { user: true } }, admission: true },
    });
  }

  findAll(filters: { status?: string; triageLevel?: string; patientId?: number; from?: string; to?: string }) {
    return this.prisma.emergencyVisit.findMany({
      where: {
        ...(filters.status ? { status: filters.status as never } : {}),
        ...(filters.triageLevel ? { triageLevel: filters.triageLevel as never } : {}),
        ...(filters.patientId ? { patientId: filters.patientId } : {}),
        ...(filters.from || filters.to ? { arrivalAt: {
          ...(filters.from ? { gte: new Date(filters.from) } : {}),
          ...(filters.to ? { lte: new Date(filters.to) } : {}),
        } } : {}),
      },
      include: { patient: true, attendingDoctor: { include: { user: true } }, admission: true },
      orderBy: [{ arrivalAt: 'desc' }],
    });
  }

  async findOne(id: number) {
    const row = await this.prisma.emergencyVisit.findUnique({
      where: { id },
      include: { patient: true, attendingDoctor: { include: { user: true } }, admission: true, createdBy: true },
    });
    if (!row) throw new NotFoundException('Emergency visit not found');
    return row;
  }

  async update(id: number, dto: UpdateEmergencyVisitDto) {
    await this.findOne(id);
    if (dto.admissionId) await this.prisma.admission.findUniqueOrThrow({ where: { id: dto.admissionId } })
      .catch(() => { throw new NotFoundException('Admission not found'); });
    if (dto.attendingDoctorId) await this.prisma.doctor.findUniqueOrThrow({ where: { id: dto.attendingDoctorId } })
      .catch(() => { throw new NotFoundException('Doctor not found'); });

    const terminal = ['DISCHARGED', 'CANCELLED', 'LEFT_WITHOUT_BEING_SEEN', 'TRANSFERRED'];
    if (dto.status && terminal.includes(dto.status)) {
      return this.prisma.emergencyVisit.update({
        where: { id },
        data: { ...dto as any, ...(dto.status === 'DISCHARGED' ? { dischargedAt: new Date() } : {}) },
        include: { patient: true, attendingDoctor: true, admission: true },
      });
    }
    return this.prisma.emergencyVisit.update({ where: { id }, data: dto as any, include: { patient: true, attendingDoctor: true, admission: true } });
  }

  async setStatus(id: number, status: string, disposition?: string) {
    const current = await this.findOne(id);
    if (['DISCHARGED', 'CANCELLED', 'LEFT_WITHOUT_BEING_SEEN', 'TRANSFERRED'].includes(current.status)) {
      throw new BadRequestException('A closed emergency visit cannot be reopened through this endpoint');
    }
    return this.prisma.emergencyVisit.update({
      where: { id },
      data: {
        status: status as never,
        ...(disposition !== undefined ? { disposition } : {}),
        ...(status === 'DISCHARGED' ? { dischargedAt: new Date() } : {}),
      },
      include: { patient: true, admission: true },
    });
  }
}

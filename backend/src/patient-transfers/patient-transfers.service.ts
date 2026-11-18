import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePatientTransferDto } from './dto/create-patient-transfer.dto.js';

@Injectable()
export class PatientTransfersService {
  constructor(private readonly prisma: PrismaService) {}
  private ref() { return `TR-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`; }

  async create(dto: CreatePatientTransferDto, userId: number) {
    const patient = await this.prisma.patient.findUnique({ where: { id: dto.patientId } });
    if (!patient) throw new NotFoundException('Patient not found');
    const ward = await this.prisma.ward.findUnique({ where: { id: dto.toWardId } });
    if (!ward) throw new NotFoundException('Destination ward not found');
    if (dto.fromWardId && dto.fromWardId === dto.toWardId) throw new BadRequestException('Destination ward must differ from source ward');
    if (dto.admissionId) {
      const admission = await this.prisma.admission.findUnique({ where: { id: dto.admissionId } });
      if (!admission || admission.patientId !== dto.patientId || admission.status !== 'ADMITTED') throw new BadRequestException('A current admission for this patient is required');
    }
    if (dto.toBedId) {
      const bed = await this.prisma.bed.findUnique({ where: { id: dto.toBedId }, include: { room: true } });
      if (!bed || bed.room.wardId !== dto.toWardId) throw new BadRequestException('Destination bed does not belong to the destination ward');
      if (bed.status !== 'AVAILABLE') throw new ConflictException('Destination bed is not available');
    }
    return this.prisma.patientTransfer.create({
      data: { transferNumber: this.ref(), patientId: dto.patientId, toWardId: dto.toWardId, reason: dto.reason, requestedById: userId,
        ...(dto.admissionId ? { admissionId: dto.admissionId } : {}), ...(dto.fromWardId ? { fromWardId: dto.fromWardId } : {}),
        ...(dto.fromBedId ? { fromBedId: dto.fromBedId } : {}), ...(dto.toBedId ? { toBedId: dto.toBedId } : {}), ...(dto.notes ? { notes: dto.notes } : {}) },
      include: { patient: true, admission: true, fromWard: true, toWard: true, fromBed: true, toBed: true, requestedBy: true },
    });
  }

  findAll(status?: string, patientId?: number) {
    return this.prisma.patientTransfer.findMany({ where: { ...(status ? { status: status as never } : {}), ...(patientId ? { patientId } : {}) },
      include: { patient: true, fromWard: true, toWard: true, fromBed: true, toBed: true, requestedBy: true, approvedBy: true }, orderBy: { requestedAt: 'desc' } });
  }

  async findOne(id: number) {
    const row = await this.prisma.patientTransfer.findUnique({ where: { id }, include: { patient: true, admission: true, fromWard: true, toWard: true, fromBed: true, toBed: true, requestedBy: true, approvedBy: true } });
    if (!row) throw new NotFoundException('Patient transfer not found');
    return row;
  }

  async approve(id: number, userId: number) {
    const row = await this.findOne(id);
    if (row.status !== 'REQUESTED') throw new BadRequestException('Only requested transfers can be approved');
    if (row.toBedId) {
      const bed = await this.prisma.bed.findUnique({ where: { id: row.toBedId } });
      if (!bed || bed.status !== 'AVAILABLE') throw new ConflictException('Destination bed is no longer available');
    }
    return this.prisma.patientTransfer.update({ where: { id }, data: { status: 'APPROVED', approvedAt: new Date(), approvedById: userId } });
  }

  async reject(id: number, notes?: string) {
    const row = await this.findOne(id);
    if (row.status !== 'REQUESTED') throw new BadRequestException('Only requested transfers can be rejected');
    return this.prisma.patientTransfer.update({ where: { id }, data: { status: 'REJECTED', ...(notes ? { notes } : {}) } });
  }

  async start(id: number) {
    const row = await this.findOne(id);
    if (row.status !== 'APPROVED') throw new BadRequestException('Only approved transfers can enter transit');
    return this.prisma.patientTransfer.update({ where: { id }, data: { status: 'IN_TRANSIT' } });
  }

  async complete(id: number) {
    const row = await this.findOne(id);
    if (row.status !== 'IN_TRANSIT') throw new BadRequestException('Only in-transit transfers can be completed');
    return this.prisma.$transaction(async (tx) => {
      if (row.toBedId) {
        const destination = await tx.bed.findUnique({ where: { id: row.toBedId } });
        if (!destination || destination.status !== 'AVAILABLE') throw new ConflictException('Destination bed is no longer available');
      }
      if (row.fromBedId) await tx.bed.updateMany({ where: { id: row.fromBedId }, data: { status: 'AVAILABLE' } });
      if (row.toBedId) await tx.bed.update({ where: { id: row.toBedId }, data: { status: 'OCCUPIED' } });
      if (row.admissionId && row.toBedId) await tx.admission.update({ where: { id: row.admissionId }, data: { bedId: row.toBedId } });
      return tx.patientTransfer.update({ where: { id }, data: { status: 'COMPLETED', completedAt: new Date() },
        include: { patient: true, admission: true, fromWard: true, toWard: true, fromBed: true, toBed: true } });
    });
  }
}

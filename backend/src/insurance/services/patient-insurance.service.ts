import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreatePatientInsuranceDto } from '../dto/create-patient-insurance.dto.js';
import { UpdatePatientInsuranceDto } from '../dto/update-patient-insurance.dto.js';

@Injectable()
export class PatientInsuranceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePatientInsuranceDto, userId: number) {
    const [patient, provider] = await Promise.all([
      this.prisma.patient.findUnique({ where: { id: dto.patientId }, select: { id: true } }),
      this.prisma.insuranceProvider.findUnique({
        where: { id: dto.providerId }, select: { id: true, isActive: true },
      }),
    ]);
    if (!patient) throw new NotFoundException('Patient not found');
    if (!provider) throw new NotFoundException('Insurance provider not found');
    if (!provider.isActive) throw new BadRequestException('Insurance provider is inactive');

    const start = dto.coverageStart ? new Date(dto.coverageStart) : null;
    const end = dto.coverageEnd ? new Date(dto.coverageEnd) : null;
    if (start && end && start > end) throw new BadRequestException('coverageStart must be on or before coverageEnd');

    try {
      return await this.prisma.$transaction(async tx => {
        if (dto.isPrimary) {
          await tx.patientInsurance.updateMany({
            where: { patientId: dto.patientId, isActive: true, isPrimary: true },
            data: { isPrimary: false },
          });
        }
        const policy = await tx.patientInsurance.create({
          data: {
            patientId: dto.patientId,
            providerId: dto.providerId,
            policyNumber: dto.policyNumber.trim(),
            memberNumber: dto.memberNumber?.trim() || null,
            coverageStart: start,
            coverageEnd: end,
            coverageLimit: dto.coverageLimit !== undefined ? new Prisma.Decimal(dto.coverageLimit) : null,
            isPrimary: dto.isPrimary ?? false,
            notes: dto.notes?.trim() || null,
          },
          include: { patient: true, provider: true },
        });
        await tx.auditLog.create({
          data: {
            action: 'CREATE',
            entity: 'PatientInsurance',
            entityId: String(policy.id),
            userId,
            newData: {
              patientId: policy.patientId,
              providerId: policy.providerId,
              policyNumber: policy.policyNumber,
              isPrimary: policy.isPrimary,
            },
          },
        });
        return policy;
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException('This policy number is already registered for the provider');
      }
      throw error;
    }
  }

  findAll(filters: { patientId?: number; providerId?: number; active?: boolean }) {
    return this.prisma.patientInsurance.findMany({
      where: {
        ...(filters.patientId !== undefined ? { patientId: filters.patientId } : {}),
        ...(filters.providerId !== undefined ? { providerId: filters.providerId } : {}),
        ...(filters.active !== undefined ? { isActive: filters.active } : {}),
      },
      include: { patient: true, provider: true },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: number) {
    const policy = await this.prisma.patientInsurance.findUnique({
      where: { id },
      include: { patient: true, provider: true, claims: true },
    });
    if (!policy) throw new NotFoundException('Patient insurance policy not found');
    return policy;
  }

  async update(id: number, dto: UpdatePatientInsuranceDto, userId: number) {
    const current = await this.findOne(id);
    const start = dto.coverageStart === undefined
      ? current.coverageStart
      : dto.coverageStart === null ? null : new Date(dto.coverageStart);
    const end = dto.coverageEnd === undefined
      ? current.coverageEnd
      : dto.coverageEnd === null ? null : new Date(dto.coverageEnd);
    if (start && end && start > end) throw new BadRequestException('coverageStart must be on or before coverageEnd');
    if (dto.isActive === false && dto.isPrimary === true) {
      throw new BadRequestException('An inactive policy cannot be marked as primary');
    }

    return this.prisma.$transaction(async tx => {
      if (dto.isPrimary) {
        await tx.patientInsurance.updateMany({
          where: { patientId: current.patientId, id: { not: id }, isActive: true, isPrimary: true },
          data: { isPrimary: false },
        });
      }
      const updated = await tx.patientInsurance.update({
        where: { id },
        data: {
          ...(dto.policyNumber !== undefined ? { policyNumber: dto.policyNumber.trim() } : {}),
          ...(dto.memberNumber !== undefined ? { memberNumber: dto.memberNumber?.trim() || null } : {}),
          ...(dto.coverageStart !== undefined ? { coverageStart: start } : {}),
          ...(dto.coverageEnd !== undefined ? { coverageEnd: end } : {}),
          ...(dto.coverageLimit !== undefined ? {
            coverageLimit: dto.coverageLimit === null ? null : new Prisma.Decimal(dto.coverageLimit),
          } : {}),
          ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
          ...(dto.isActive !== undefined ? {
            isActive: dto.isActive,
            ...(dto.isActive ? {} : { isPrimary: false }),
          } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        },
        include: { patient: true, provider: true },
      });
      await tx.auditLog.create({
        data: {
          action: 'UPDATE',
          entity: 'PatientInsurance',
          entityId: String(id),
          userId,
          oldData: {
            isActive: current.isActive,
            isPrimary: current.isPrimary,
            policyNumber: current.policyNumber,
          },
          newData: {
            isActive: updated.isActive,
            isPrimary: updated.isPrimary,
            policyNumber: updated.policyNumber,
          },
        },
      });
      return updated;
    });
  }
}

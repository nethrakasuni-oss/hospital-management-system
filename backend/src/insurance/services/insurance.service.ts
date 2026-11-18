import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateProviderDto } from '../dto/create-provider.dto.js';
import { UpdateProviderDto } from '../dto/update-provider.dto.js';
import { CreatePatientInsuranceDto } from '../dto/create-patient-insurance.dto.js';
import { UpdatePatientInsuranceDto } from '../dto/update-patient-insurance.dto.js';
import { CreateClaimDto } from '../dto/create-claim.dto.js';
import { ReviewClaimDto } from '../dto/review-claim.dto.js';
import { RecordClaimPaymentDto } from '../dto/record-claim-payment.dto.js';

@Injectable()
export class InsuranceService {
  constructor(private readonly prisma: PrismaService) {}

  async createProvider(dto: CreateProviderDto) {
    try {
      return await this.prisma.insuranceProvider.create({
        data: {
          name: dto.name.trim(),
          code: dto.code?.trim().toUpperCase() || null,
          contactPerson: dto.contactPerson?.trim() || null,
          email: dto.email?.trim().toLowerCase() || null,
          phone: dto.phone?.trim() || null,
          address: dto.address?.trim() || null,
        },
      });
    } catch (e) {
      if ((e as {code?: string}).code === 'P2002') throw new ConflictException('Insurance provider code already exists');
      throw e;
    }
  }

  findProviders(includeInactive = false) {
    return this.prisma.insuranceProvider.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: { _count: { select: { patientInsurances: true, claims: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async updateProvider(id: number, dto: UpdateProviderDto) {
    const current = await this.prisma.insuranceProvider.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Insurance provider not found');
    return this.prisma.insuranceProvider.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.contactPerson !== undefined ? { contactPerson: dto.contactPerson?.trim() || null } : {}),
        ...(dto.email !== undefined ? { email: dto.email?.trim().toLowerCase() || null } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
        ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async createPatientInsurance(dto: CreatePatientInsuranceDto) {
    const [patient, provider] = await Promise.all([
      this.prisma.patient.findUnique({ where: { id: dto.patientId }, select: { id: true } }),
      this.prisma.insuranceProvider.findUnique({ where: { id: dto.providerId } }),
    ]);
    if (!patient) throw new NotFoundException('Patient not found');
    if (!provider || !provider.isActive) throw new BadRequestException('Insurance provider does not exist or is inactive');

    const start = dto.coverageStart ? new Date(dto.coverageStart) : null;
    const end = dto.coverageEnd ? new Date(dto.coverageEnd) : null;
    if (start && end && start > end) throw new BadRequestException('Coverage start must be before coverage end');

    try {
      return await this.prisma.$transaction(async tx => {
        if (dto.isPrimary) {
          await tx.patientInsurance.updateMany({
            where: { patientId: dto.patientId, isPrimary: true },
            data: { isPrimary: false },
          });
        }
        return tx.patientInsurance.create({
          data: {
            patientId: dto.patientId,
            providerId: dto.providerId,
            policyNumber: dto.policyNumber.trim(),
            memberNumber: dto.memberNumber?.trim() || null,
            coverageStart: start,
            coverageEnd: end,
            coverageLimit: dto.coverageLimit === undefined ? null : new Prisma.Decimal(dto.coverageLimit),
            isPrimary: dto.isPrimary ?? false,
            notes: dto.notes?.trim() || null,
          },
          include: { patient: true, provider: true },
        });
      });
    } catch (e) {
      if ((e as {code?: string}).code === 'P2002') throw new ConflictException('This policy number is already registered with this provider');
      throw e;
    }
  }

  findPatientInsurances(patientId?: number, activeOnly = false) {
    return this.prisma.patientInsurance.findMany({
      where: {
        ...(patientId !== undefined ? { patientId } : {}),
        ...(activeOnly ? { isActive: true } : {}),
      },
      include: { patient: true, provider: true },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async updatePatientInsurance(id: number, dto: UpdatePatientInsuranceDto) {
    const current = await this.prisma.patientInsurance.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Patient insurance policy not found');
    const start = dto.coverageStart === undefined ? current.coverageStart : dto.coverageStart ? new Date(dto.coverageStart) : null;
    const end = dto.coverageEnd === undefined ? current.coverageEnd : dto.coverageEnd ? new Date(dto.coverageEnd) : null;
    if (start && end && start > end) throw new BadRequestException('Coverage start must be before coverage end');

    return this.prisma.$transaction(async tx => {
      if (dto.isPrimary) {
        await tx.patientInsurance.updateMany({
          where: { patientId: current.patientId, isPrimary: true, id: { not: id } },
          data: { isPrimary: false },
        });
      }
      return tx.patientInsurance.update({
        where: { id },
        data: {
          ...(dto.memberNumber !== undefined ? { memberNumber: dto.memberNumber?.trim() || null } : {}),
          ...(dto.coverageStart !== undefined ? { coverageStart: start } : {}),
          ...(dto.coverageEnd !== undefined ? { coverageEnd: end } : {}),
          ...(dto.coverageLimit !== undefined ? { coverageLimit: dto.coverageLimit === null ? null : new Prisma.Decimal(dto.coverageLimit) } : {}),
          ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        },
        include: { patient: true, provider: true },
      });
    });
  }

  private claimNumber() {
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `CLM-${day}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  async createClaim(dto: CreateClaimDto, userId: number) {
    const [patient, provider, policy, invoice] = await Promise.all([
      this.prisma.patient.findUnique({ where: { id: dto.patientId }, select: { id: true } }),
      this.prisma.insuranceProvider.findUnique({ where: { id: dto.providerId } }),
      dto.patientInsuranceId
        ? this.prisma.patientInsurance.findUnique({ where: { id: dto.patientInsuranceId } })
        : Promise.resolve(null),
      dto.invoiceId
        ? this.prisma.invoice.findUnique({ where: { id: dto.invoiceId } })
        : Promise.resolve(null),
    ]);
    if (!patient) throw new NotFoundException('Patient not found');
    if (!provider || !provider.isActive) throw new BadRequestException('Insurance provider is inactive or missing');
    if (dto.patientInsuranceId && !policy) throw new NotFoundException('Patient insurance policy not found');
    if (policy && (policy.patientId !== dto.patientId || policy.providerId !== dto.providerId || !policy.isActive)) {
      throw new BadRequestException('Selected policy must be active and belong to this patient and provider');
    }
    if (policy) {
      const now = new Date();
      if (policy.coverageStart && policy.coverageStart > now) throw new BadRequestException('Insurance coverage has not started');
      if (policy.coverageEnd && policy.coverageEnd < now) throw new BadRequestException('Insurance policy has expired');
      if (policy.coverageLimit && new Prisma.Decimal(dto.claimedAmount).greaterThan(policy.coverageLimit)) {
        throw new BadRequestException('Claimed amount exceeds the policy coverage limit');
      }
    }
    if (dto.invoiceId && !invoice) throw new NotFoundException('Invoice not found');
    if (invoice && invoice.patientId !== dto.patientId) throw new BadRequestException('Invoice does not belong to this patient');
    if (invoice && new Prisma.Decimal(dto.claimedAmount).greaterThan(invoice.totalAmount)) {
      throw new BadRequestException('Claimed amount cannot exceed invoice total');
    }

    try {
      const claim = await this.prisma.insuranceClaim.create({
        data: {
          claimNumber: this.claimNumber(),
          status: 'DRAFT' as any,
          claimedAmount: new Prisma.Decimal(dto.claimedAmount),
          paidAmount: new Prisma.Decimal(0),
          patientId: dto.patientId,
          providerId: dto.providerId,
          ...(dto.patientInsuranceId ? { patientInsuranceId: dto.patientInsuranceId } : {}),
          ...(dto.invoiceId ? { invoiceId: dto.invoiceId } : {}),
        },
        include: { patient: true, provider: true, patientInsurance: true, invoice: true },
      });
      await this.prisma.auditLog.create({
        data: {
          action: 'CREATE',
          entity: 'InsuranceClaim',
          entityId: String(claim.id),
          userId,
          newData: { claimNumber: claim.claimNumber, claimedAmount: claim.claimedAmount.toString() },
        },
      });
      return claim;
    } catch (e) {
      if ((e as {code?: string}).code === 'P2002') throw new ConflictException('Claim reference collision; retry');
      throw e;
    }
  }

  findClaims(filters: { patientId?: number; providerId?: number; status?: string }) {
    return this.prisma.insuranceClaim.findMany({
      where: {
        ...(filters.patientId !== undefined ? { patientId: filters.patientId } : {}),
        ...(filters.providerId !== undefined ? { providerId: filters.providerId } : {}),
        ...(filters.status ? { status: filters.status as any } : {}),
      },
      include: { patient: true, provider: true, patientInsurance: true, invoice: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findClaim(id: number) {
    const claim = await this.prisma.insuranceClaim.findUnique({
      where: { id },
      include: { patient: true, provider: true, patientInsurance: true, invoice: true },
    });
    if (!claim) throw new NotFoundException('Insurance claim not found');
    return claim;
  }

  async submitClaim(id: number, userId: number) {
    const claim = await this.findClaim(id);
    if (claim.status !== 'DRAFT') throw new BadRequestException('Only draft claims can be submitted');
    const updated = await this.prisma.insuranceClaim.update({
      where: { id },
      data: { status: 'SUBMITTED' as any, submittedAt: new Date() },
      include: { patient: true, provider: true, patientInsurance: true, invoice: true },
    });
    await this.prisma.auditLog.create({
      data: { action: 'SUBMIT', entity: 'InsuranceClaim', entityId: String(id), userId },
    });
    return updated;
  }

  async reviewClaim(id: number, dto: ReviewClaimDto, userId: number) {
    const claim = await this.findClaim(id);
    if (!['SUBMITTED', 'UNDER_REVIEW'].includes(claim.status)) {
      throw new BadRequestException('Only submitted or under-review claims can be reviewed');
    }
    if (dto.status === 'APPROVED' && dto.approvedAmount === undefined) {
      throw new BadRequestException('approvedAmount is required for an approved claim');
    }
    if (dto.status === 'PARTIALLY_APPROVED' && dto.approvedAmount === undefined) {
      throw new BadRequestException('approvedAmount is required for a partially approved claim');
    }
    const approved = dto.approvedAmount === undefined ? null : new Prisma.Decimal(dto.approvedAmount);
    if (approved && approved.greaterThan(claim.claimedAmount)) {
      throw new BadRequestException('Approved amount cannot exceed claimed amount');
    }
    if (dto.status === 'APPROVED' && approved && !approved.equals(claim.claimedAmount)) {
      throw new BadRequestException('For full approval, approvedAmount must equal claimedAmount');
    }
    if (dto.status === 'PARTIALLY_APPROVED' && (!approved || approved.lessThanOrEqualTo(0) || approved.greaterThanOrEqualTo(claim.claimedAmount))) {
      throw new BadRequestException('Partially approved amount must be greater than zero and less than claimed amount');
    }
    if (dto.status === 'REJECTED' && dto.approvedAmount !== undefined && dto.approvedAmount !== 0) {
      throw new BadRequestException('Rejected claims cannot have an approved amount');
    }

    const updated = await this.prisma.insuranceClaim.update({
      where: { id },
      data: {
        status: dto.status as any,
        approvedAmount: dto.status === 'REJECTED' ? null : approved,
        reviewedAt: new Date(),
        reviewedById: userId,
        reviewNotes: dto.reviewNotes?.trim() || null,
      },
      include: { patient: true, provider: true, patientInsurance: true, invoice: true },
    });
    await this.prisma.auditLog.create({
      data: {
        action: 'REVIEW',
        entity: 'InsuranceClaim',
        entityId: String(id),
        userId,
        oldData: { status: claim.status },
        newData: { status: dto.status, approvedAmount: approved?.toString() ?? null },
      },
    });
    return updated;
  }

  async recordClaimPayment(id: number, dto: RecordClaimPaymentDto, userId: number) {
    return this.prisma.$transaction(async tx => {
      const claim = await tx.insuranceClaim.findUnique({ where: { id } });
      if (!claim) throw new NotFoundException('Insurance claim not found');
      if (!['APPROVED', 'PARTIALLY_APPROVED'].includes(claim.status)) {
        throw new BadRequestException('Only approved claims can receive settlement payments');
      }
      const approved = claim.approvedAmount;
      if (!approved) throw new BadRequestException('Approved amount is not set');
      const amount = new Prisma.Decimal(dto.amount);
      const balance = approved.sub(claim.paidAmount);
      if (amount.greaterThan(balance)) throw new BadRequestException(`Payment exceeds claim settlement balance ${balance.toString()}`);
      const updated = await tx.insuranceClaim.update({
        where: { id },
        data: { paidAmount: { increment: amount } },
        include: { patient: true, provider: true, patientInsurance: true, invoice: true },
      });
      await tx.auditLog.create({
        data: {
          action: 'SETTLEMENT_RECEIVED',
          entity: 'InsuranceClaim',
          entityId: String(id),
          userId,
          newData: { amount: amount.toString(), reference: dto.reference?.trim() || null },
        },
      });
      return {
        claim: updated,
        settlementBalance: approved.sub(updated.paidAmount).toString(),
        settlementStatus: updated.paidAmount.greaterThanOrEqualTo(approved) ? 'SETTLED' : 'PARTIALLY_SETTLED',
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch(e => {
      if ((e as {code?: string}).code === 'P2034') throw new ConflictException('Concurrent settlement update; retry');
      throw e;
    });
  }

  async statistics() {
    const claims = await this.prisma.insuranceClaim.findMany({
      select: { status: true, claimedAmount: true, approvedAmount: true, paidAmount: true },
    });
    const sum = (xs: typeof claims, field: 'claimedAmount' | 'paidAmount') =>
      xs.reduce((acc, c) => acc.add(c[field]), new Prisma.Decimal(0));
    const approvedClaims = claims.filter(c => c.approvedAmount !== null);
    return {
      totalClaims: claims.length,
      claimedAmount: sum(claims, 'claimedAmount').toString(),
      approvedAmount: approvedClaims.reduce((acc, c) => acc.add(c.approvedAmount ?? 0), new Prisma.Decimal(0)).toString(),
      paidAmount: sum(claims, 'paidAmount').toString(),
      byStatus: Object.fromEntries(['DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','PARTIALLY_APPROVED','REJECTED'].map(s => [s, claims.filter(c => c.status === s).length])),
    };
  }
}

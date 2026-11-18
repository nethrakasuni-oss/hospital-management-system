import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateInsuranceClaimDto } from '../dto/create-insurance-claim.dto.js';
import { ReviewInsuranceClaimDto } from '../dto/review-insurance-claim.dto.js';
import { RecordInsuranceClaimPaymentDto } from '../dto/record-insurance-claim-payment.dto.js';

@Injectable()
export class InsuranceClaimService {
  constructor(private readonly prisma: PrismaService) {}

  private claimNumber() {
    return `CLM-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  async create(dto: CreateInsuranceClaimDto, userId: number) {
    const [patient, provider, policy, invoice] = await Promise.all([
      this.prisma.patient.findUnique({ where: { id: dto.patientId }, select: { id: true } }),
      this.prisma.insuranceProvider.findUnique({
        where: { id: dto.providerId }, select: { id: true, isActive: true },
      }),
      dto.patientInsuranceId
        ? this.prisma.patientInsurance.findUnique({ where: { id: dto.patientInsuranceId } })
        : Promise.resolve(null),
      dto.invoiceId
        ? this.prisma.invoice.findUnique({ where: { id: dto.invoiceId } })
        : Promise.resolve(null),
    ]);

    if (!patient) throw new NotFoundException('Patient not found');
    if (!provider) throw new NotFoundException('Insurance provider not found');
    if (!provider.isActive) throw new BadRequestException('Insurance provider is inactive');
    if (dto.patientInsuranceId && !policy) throw new NotFoundException('Patient insurance policy not found');
    if (policy && (
      policy.patientId !== dto.patientId ||
      policy.providerId !== dto.providerId ||
      !policy.isActive
    )) {
      throw new BadRequestException('Selected policy must be active and belong to the specified patient and provider');
    }
    if (dto.invoiceId && !invoice) throw new NotFoundException('Invoice not found');
    if (invoice && invoice.patientId !== dto.patientId) {
      throw new BadRequestException('Invoice does not belong to this patient');
    }

    const claimedAmount = new Prisma.Decimal(dto.claimedAmount);
    if (invoice && claimedAmount.greaterThan(invoice.totalAmount)) {
      throw new BadRequestException('Claimed amount cannot exceed invoice total');
    }
    if (policy) {
      const now = new Date();
      if (policy.coverageStart && policy.coverageStart > now) {
        throw new BadRequestException('Insurance coverage has not started');
      }
      if (policy.coverageEnd && policy.coverageEnd < now) {
        throw new BadRequestException('Insurance policy has expired');
      }
      if (policy.coverageLimit && claimedAmount.greaterThan(policy.coverageLimit)) {
        throw new BadRequestException('Claimed amount exceeds the policy coverage limit');
      }
    }

    try {
      return await this.prisma.$transaction(async tx => {
        const claim = await tx.insuranceClaim.create({
          data: {
            claimNumber: this.claimNumber(),
            claimedAmount,
            reviewNotes: dto.reviewNotes?.trim() || null,
            patientId: dto.patientId,
            providerId: dto.providerId,
            patientInsuranceId: dto.patientInsuranceId ?? null,
            invoiceId: dto.invoiceId ?? null,
          },
          include: {
            patient: true, provider: true, patientInsurance: true,
            invoice: true, reviewedBy: true,
          },
        });
        await tx.auditLog.create({
          data: {
            action: 'CREATE',
            entity: 'InsuranceClaim',
            entityId: String(claim.id),
            userId,
            newData: {
              claimNumber: claim.claimNumber,
              claimedAmount: claim.claimedAmount.toString(),
              patientId: claim.patientId,
              providerId: claim.providerId,
            },
          },
        });
        return claim;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'P2002') throw new ConflictException('Claim reference already exists; please retry');
      if (code === 'P2034') throw new ConflictException('Claim creation conflicted with another transaction; please retry');
      throw error;
    }
  }

  findAll(filters: { patientId?: number; providerId?: number; status?: string }) {
    return this.prisma.insuranceClaim.findMany({
      where: {
        ...(filters.patientId !== undefined ? { patientId: filters.patientId } : {}),
        ...(filters.providerId !== undefined ? { providerId: filters.providerId } : {}),
        ...(filters.status ? { status: filters.status as never } : {}),
      },
      include: { patient: true, provider: true, patientInsurance: true, invoice: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const claim = await this.prisma.insuranceClaim.findUnique({
      where: { id },
      include: {
        patient: true, provider: true, patientInsurance: true,
        invoice: true, reviewedBy: true,
      },
    });
    if (!claim) throw new NotFoundException('Insurance claim not found');
    return claim;
  }

  async submit(id: number, userId: number) {
    const claim = await this.findOne(id);
    if (claim.status !== 'DRAFT') throw new BadRequestException('Only draft claims can be submitted');
    const updated = await this.prisma.insuranceClaim.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
      include: { patient: true, provider: true, patientInsurance: true, invoice: true },
    });
    await this.prisma.auditLog.create({
      data: {
        action: 'SUBMIT',
        entity: 'InsuranceClaim',
        entityId: String(id),
        userId,
        oldData: { status: claim.status },
        newData: { status: updated.status },
      },
    });
    return updated;
  }

  async review(id: number, reviewerId: number, dto: ReviewInsuranceClaimDto) {
    const claim = await this.findOne(id);
    if (!['SUBMITTED', 'UNDER_REVIEW'].includes(claim.status)) {
      throw new BadRequestException('Only submitted or under-review claims can be reviewed');
    }

    let approvedAmount: Prisma.Decimal | null = null;
    if (dto.status !== 'REJECTED') {
      approvedAmount = new Prisma.Decimal(dto.approvedAmount ?? claim.claimedAmount);
      if (approvedAmount.greaterThan(claim.claimedAmount)) {
        throw new BadRequestException('Approved amount cannot exceed claimed amount');
      }
      if (dto.status === 'APPROVED' && !approvedAmount.equals(claim.claimedAmount)) {
        throw new BadRequestException('For full approval, approvedAmount must equal claimedAmount');
      }
      if (dto.status === 'PARTIALLY_APPROVED' && (
        approvedAmount.lessThanOrEqualTo(0) ||
        approvedAmount.greaterThanOrEqualTo(claim.claimedAmount)
      )) {
        throw new BadRequestException('Partially approved amount must be greater than zero and less than claimed amount');
      }
    } else if (dto.approvedAmount !== undefined && dto.approvedAmount !== 0) {
      throw new BadRequestException('Rejected claims cannot have an approved amount');
    }

    const updated = await this.prisma.$transaction(async tx => {
      const result = await tx.insuranceClaim.update({
        where: { id },
        data: {
          status: dto.status,
          approvedAmount,
          reviewedAt: new Date(),
          reviewedById: reviewerId,
          reviewNotes: dto.reviewNotes?.trim() || null,
        },
        include: {
          patient: true, provider: true, patientInsurance: true,
          invoice: true, reviewedBy: true,
        },
      });
      await tx.auditLog.create({
        data: {
          action: 'REVIEW',
          entity: 'InsuranceClaim',
          entityId: String(id),
          userId: reviewerId,
          oldData: { status: claim.status, approvedAmount: claim.approvedAmount?.toString() ?? null },
          newData: {
            status: result.status,
            approvedAmount: result.approvedAmount?.toString() ?? null,
            reviewNotes: result.reviewNotes,
          },
        },
      });
      return result;
    });
    return updated;
  }

  async recordPayment(id: number, dto: RecordInsuranceClaimPaymentDto, userId: number) {
    const amount = new Prisma.Decimal(dto.amount);
    try {
      return await this.prisma.$transaction(async tx => {
        const claim = await tx.insuranceClaim.findUnique({ where: { id } });
        if (!claim) throw new NotFoundException('Insurance claim not found');
        if (!['APPROVED', 'PARTIALLY_APPROVED'].includes(claim.status)) {
          throw new BadRequestException('Only approved claims can receive payments');
        }
        if (!claim.approvedAmount) throw new BadRequestException('Approved amount is not set');
        const balance = claim.approvedAmount.sub(claim.paidAmount);
        if (amount.greaterThan(balance)) {
          throw new BadRequestException(`Payment exceeds outstanding approved amount of ${balance.toString()}`);
        }

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
            newData: {
              amount: amount.toString(),
              reference: dto.reference?.trim() || null,
              paidAmount: updated.paidAmount.toString(),
              remaining: updated.approvedAmount!.sub(updated.paidAmount).toString(),
            },
          },
        });
        return {
          claim: updated,
          settlementBalance: updated.approvedAmount!.sub(updated.paidAmount).toString(),
          settlementStatus: updated.paidAmount.greaterThanOrEqualTo(updated.approvedAmount!)
            ? 'SETTLED'
            : 'PARTIALLY_SETTLED',
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2034') {
        throw new ConflictException('Concurrent settlement detected; refresh and retry');
      }
      throw error;
    }
  }

  async statistics() {
    const claims = await this.prisma.insuranceClaim.findMany({
      select: {
        status: true,
        claimedAmount: true,
        approvedAmount: true,
        paidAmount: true,
        createdAt: true,
      },
    });
    const zero = new Prisma.Decimal(0);
    const claimed = claims.reduce((sum, claim) => sum.add(claim.claimedAmount), zero);
    const approved = claims.reduce((sum, claim) => sum.add(claim.approvedAmount ?? zero), zero);
    const paid = claims.reduce((sum, claim) => sum.add(claim.paidAmount), zero);
    const statuses = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'];
    return {
      totalClaims: claims.length,
      claimedAmount: claimed.toString(),
      approvedAmount: approved.toString(),
      paidAmount: paid.toString(),
      outstandingApprovedAmount: approved.sub(paid).toString(),
      byStatus: Object.fromEntries(statuses.map(status => [
        status,
        claims.filter(claim => claim.status === status).length,
      ])),
    };
  }
}

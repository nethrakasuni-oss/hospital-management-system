import {
  BadRequestException, ConflictException, ForbiddenException,
  Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateLabTestDto } from '../dto/create-lab-test.dto.js';
import { UpdateLabTestDto } from '../dto/update-lab-test.dto.js';
import { CreateLabRequestDto } from '../dto/create-lab-request.dto.js';
import { UpdateLabRequestStatusDto } from '../dto/update-lab-request-status.dto.js';
import { UpsertLabResultDto } from '../dto/upsert-lab-result.dto.js';
import { CollectLabSampleDto } from '../dto/collect-lab-sample.dto.js';
import { VerifyLabResultDto } from '../dto/verify-lab-result.dto.js';
import { randomUUID } from 'node:crypto';

@Injectable()
export class LaboratoryService {
  constructor(private readonly prisma: PrismaService) {}

  async createTest(dto: CreateLabTestDto) {
    try {
      return await this.prisma.labTest.create({
        data: {
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          price: new Prisma.Decimal(dto.price),
          category: dto.category?.trim() || null,
          sampleType: dto.sampleType?.trim() || null,
          referenceRange: dto.referenceRange?.trim() || null,
          unit: dto.unit?.trim() || null,
          active: dto.active ?? true,
        },
      });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException('A laboratory test with this code already exists');
      }
      throw error;
    }
  }

  findTests(includeInactive = false) {
    return this.prisma.labTest.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: { name: 'asc' },
    });
  }

  async findTest(id: number) {
    const test = await this.prisma.labTest.findUnique({ where: { id } });
    if (!test) throw new NotFoundException('Laboratory test not found');
    return test;
  }

  async updateTest(id: number, dto: UpdateLabTestDto) {
    await this.findTest(id);
    return this.prisma.labTest.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.price !== undefined ? { price: new Prisma.Decimal(dto.price) } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.category !== undefined ? { category: dto.category?.trim() || null } : {}),
        ...(dto.sampleType !== undefined ? { sampleType: dto.sampleType?.trim() || null } : {}),
        ...(dto.referenceRange !== undefined ? { referenceRange: dto.referenceRange?.trim() || null } : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit?.trim() || null } : {}),
      },
    });
  }

  async createRequest(dto: CreateLabRequestDto, userId: number, role: string) {
    const [patient, doctor, tests, medicalRecord] = await Promise.all([
      this.prisma.patient.findUnique({ where: { id: dto.patientId }, select: { id: true } }),
      this.prisma.doctor.findUnique({ where: { id: dto.doctorId }, select: { id: true, userId: true, active: true } }),
      this.prisma.labTest.findMany({
        where: { id: { in: [...new Set(dto.labTestIds)] }, active: true },
        select: { id: true },
      }),
      dto.medicalRecordId
        ? this.prisma.medicalRecord.findUnique({
            where: { id: dto.medicalRecordId },
            select: { id: true, patientId: true, doctorId: true },
          })
        : Promise.resolve(null),
    ]);

    if (!patient) throw new NotFoundException('Patient not found');
    if (!doctor) throw new NotFoundException('Doctor not found');
    if (!doctor.active) throw new BadRequestException('Doctor is inactive');
    if (role === 'DOCTOR' && doctor.userId !== userId) {
      throw new ForbiddenException('Doctors can only request tests under their own profile');
    }
    if (tests.length !== new Set(dto.labTestIds).size) {
      throw new BadRequestException('One or more laboratory tests do not exist or are inactive');
    }
    if (dto.medicalRecordId && !medicalRecord) {
      throw new NotFoundException('Medical record not found');
    }
    if (medicalRecord && (
      medicalRecord.patientId !== dto.patientId ||
      medicalRecord.doctorId !== dto.doctorId
    )) {
      throw new BadRequestException('Medical record must belong to the selected patient and doctor');
    }

    return this.prisma.labRequest.create({
      data: {
        requestNumber: `LAB-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`,
        patientId: dto.patientId,
        doctorId: dto.doctorId,
        ...(dto.medicalRecordId ? { medicalRecordId: dto.medicalRecordId } : {}),
        notes: dto.notes?.trim() || null,
        items: {
          create: [...new Set(dto.labTestIds)].map((labTestId) => ({ labTestId })),
        },
      },
      include: {
        patient: true,
        doctor: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        medicalRecord: true,
        items: { include: { labTest: true, result: true } },
      },
    });
  }

  async findRequests(filters: { patientId?: number; doctorId?: number; status?: string }, userId: number, role: string) {
    let doctorId = filters.doctorId;
    if (role === 'DOCTOR') {
      const ownDoctor = await this.prisma.doctor.findUnique({ where: { userId }, select: { id: true } });
      if (!ownDoctor) throw new ForbiddenException('No doctor profile is linked to this account');
      if (doctorId !== undefined && doctorId !== ownDoctor.id) {
        throw new ForbiddenException('You can only view your own laboratory requests');
      }
      doctorId = ownDoctor.id;
    }
    return this.prisma.labRequest.findMany({
      where: {
        ...(filters.patientId !== undefined ? { patientId: filters.patientId } : {}),
        ...(doctorId !== undefined ? { doctorId } : {}),
        ...(filters.status ? { status: filters.status as any } : {}),
      },
      include: {
        patient: true,
        doctor: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        items: { include: { labTest: true, result: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findRequest(id: number, userId: number, role: string) {
    const request = await this.prisma.labRequest.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        medicalRecord: true,
        items: { include: { labTest: true, result: true } },
      },
    });
    if (!request) throw new NotFoundException('Laboratory request not found');
    if (role === 'DOCTOR' && request.doctor.userId !== userId) {
      throw new ForbiddenException('You can only view your own laboratory requests');
    }
    return request;
  }

  async updateRequestStatus(id: number, dto: UpdateLabRequestStatusDto, userId: number, role: string) {
    const current = await this.findRequest(id, userId, role);
    const allowed: Record<string, string[]> = {
      REQUESTED: ['SAMPLE_PENDING', 'SAMPLE_COLLECTED', 'CANCELLED', 'REJECTED'],
      SAMPLE_PENDING: ['SAMPLE_COLLECTED', 'CANCELLED', 'REJECTED'],
      SAMPLE_COLLECTED: ['RECEIVED', 'PROCESSING', 'CANCELLED', 'REJECTED'],
      RECEIVED: ['PROCESSING', 'CANCELLED', 'REJECTED'],
      PROCESSING: ['RESULT_ENTERED', 'CANCELLED', 'REJECTED'],
      RESULT_ENTERED: ['VERIFIED', 'PROCESSING', 'CANCELLED'],
      VERIFIED: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      REJECTED: [],
      CANCELLED: [],
    };
    if (!allowed[current.status].includes(dto.status)) {
      throw new BadRequestException(`Cannot change laboratory request from ${current.status} to ${dto.status}`);
    }
    if (dto.status === 'COMPLETED') {
      const missing = current.items.filter((item) => !item.result || !item.result.resultValue?.trim() || !item.result.verifiedAt);
      if (missing.length) {
        throw new BadRequestException('All requested tests must have verified results before completion');
      }
    }
    return this.prisma.labRequest.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
      },
      include: {
        patient: true,
        doctor: true,
        items: { include: { labTest: true, result: true } },
      },
    });
  }

  async upsertResult(dto: UpsertLabResultDto, userId: number, role: string) {
    const item = await this.prisma.labRequestItem.findUnique({
      where: { id: dto.labRequestItemId },
      include: { labRequest: { include: { doctor: true } }, result: true, labTest: true },
    });
    if (!item) throw new NotFoundException('Laboratory request item not found');
    if (role === 'DOCTOR' && item.labRequest.doctor.userId !== userId) {
      throw new ForbiddenException('You can only enter results for your own requests');
    }
    if (['COMPLETED', 'CANCELLED'].includes(item.labRequest.status)) {
      throw new BadRequestException('Results cannot be changed after the request is finalized');
    }
    const data = {
      resultValue: dto.resultValue?.trim() || null,
      referenceRange: dto.referenceRange?.trim() || null,
      remarks: dto.remarks?.trim() || null,
      unit: dto.unit?.trim() || null,
      abnormalFlag: dto.abnormalFlag ?? null,
      critical: dto.critical ?? false,
      comments: dto.comments?.trim() || null,
    };
    return this.prisma.$transaction(async tx => {
      const existing = item.result;
      if (existing?.verifiedAt) {
        if (!['ADMIN', 'LAB_MANAGER', 'PATHOLOGIST'].includes(role)) {
          throw new ForbiddenException('Only laboratory managers or pathologists can amend verified results');
        }
        if (!dto.amendmentReason?.trim()) {
          throw new BadRequestException('amendmentReason is required when amending a verified result');
        }
        await tx.labResultHistory.create({
          data: {
            labResultId: existing.id,
            resultValue: existing.resultValue,
            referenceRange: existing.referenceRange,
            unit: existing.unit,
            abnormalFlag: existing.abnormalFlag,
            critical: existing.critical,
            comments: existing.comments,
            amendmentReason: dto.amendmentReason.trim(),
            changedById: userId,
          },
        });
      }
      return tx.labResult.upsert({
        where: { labRequestItemId: dto.labRequestItemId },
        create: { labRequestItemId: dto.labRequestItemId, ...data, verifiedAt: null, verifiedById: null },
        update: {
          ...data,
          ...(existing?.verifiedAt ? { amendmentReason: dto.amendmentReason?.trim() || null } : {}),
          verifiedAt: null,
          verifiedById: null,
        },
        include: {
          labRequestItem: { include: { labTest: true, labRequest: true } },
          history: { orderBy: { changedAt: 'desc' } },
        },
      });
    });
  }

  async collectSample(dto: CollectLabSampleDto, userId: number) {
    const request = await this.prisma.labRequest.findUnique({
      where: { id: dto.labRequestId },
      include: { items: { include: { labTest: true } } },
    });
    if (!request) throw new NotFoundException('Laboratory request not found');
    if (['COMPLETED', 'CANCELLED', 'REJECTED'].includes(request.status)) {
      throw new BadRequestException('A finalized laboratory request cannot collect a sample');
    }
    if (request.sampleIdentifier) throw new ConflictException('A sample identifier is already registered for this request');
    if (dto.rejected && !dto.rejectionReason?.trim()) {
      throw new BadRequestException('A rejection reason is required for rejected samples');
    }
    const collectedAt = dto.collectedAt ? new Date(dto.collectedAt) : new Date();
    if (Number.isNaN(collectedAt.getTime())) throw new BadRequestException('Invalid sample collection date');
    const sampleIdentifier = `SMPL-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;
    return this.prisma.labRequest.update({
      where: { id: dto.labRequestId },
      data: {
        sampleIdentifier,
        barcode: dto.barcode?.trim() || null,
        collectedAt,
        collectedById: userId,
        sampleRejected: dto.rejected ?? false,
        rejectionReason: dto.rejected ? dto.rejectionReason?.trim() || null : null,
        status: dto.rejected ? 'REJECTED' : 'SAMPLE_COLLECTED',
      },
      include: {
        patient: true,
        doctor: { include: { user: true } },
        items: { include: { labTest: true, result: true } },
      },
    });
  }

  async verifyResult(labRequestItemId: number, dto: VerifyLabResultDto, userId: number) {
    const item = await this.prisma.labRequestItem.findUnique({
      where: { id: labRequestItemId },
      include: { result: true, labRequest: true },
    });
    if (!item) throw new NotFoundException('Laboratory request item not found');
    if (!item.result) throw new BadRequestException('No result exists to verify');
    if (item.result.verifiedAt) throw new ConflictException('This result is already verified');
    if (dto.action === 'REJECT') {
      if (!dto.reason?.trim()) throw new BadRequestException('A verification rejection reason is required');
      return this.prisma.labResult.update({
        where: { id: item.result.id },
        data: { verifiedAt: null, verifiedById: null, remarks: dto.reason.trim() },
        include: { labRequestItem: { include: { labTest: true, labRequest: true } } },
      });
    }
    const verified = await this.prisma.labResult.update({
      where: { id: item.result.id },
      data: { verifiedAt: new Date(), verifiedById: userId },
      include: {
        labRequestItem: { include: { labTest: true, labRequest: true } },
        verifiedBy: { select: { id: true, firstName: true, lastName: true } },
        history: { orderBy: { changedAt: 'desc' } },
      },
    });
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: item.labRequest.doctorId },
      select: { userId: true },
    });
    if (doctor) {
      await this.prisma.notification.create({
        data: {
          title: 'Laboratory result verified',
          message: `A laboratory result is ready for request ${item.labRequest.requestNumber || `#${item.labRequest.id}`}${item.result.critical ? ' — Critical result' : ''}`,
          type: 'SYSTEM',
          channel: 'IN_APP',
          status: 'SENT',
          sentAt: new Date(),
          userId: doctor.userId,
        },
      });
    }
    if (item.result.critical) {
      const admins = await this.prisma.user.findMany({
        where: { role: { name: 'ADMIN' } },
        select: { id: true },
      });
      await this.prisma.notification.createMany({
        data: admins.map(admin => ({
          title: 'Critical laboratory result',
          message: `Critical result for laboratory request ${item.labRequest.requestNumber || `#${item.labRequest.id}`}`,
          type: 'SYSTEM',
          channel: 'IN_APP',
          status: 'SENT',
          sentAt: new Date(),
          userId: admin.id,
        })),
      });
    }
    return verified;
  }

  async report(requestId: number, userId: number, role: string) {
    const request = await this.findRequest(requestId, userId, role);
    const allItemsVerified = request.items.every((item: any) => item.result?.verifiedAt);
    if (!allItemsVerified) throw new BadRequestException('Final report is available only after all results are verified');
    if (request.status !== 'COMPLETED') {
      throw new BadRequestException('Final report is available only for completed laboratory requests');
    }
    return {
      reportNumber: `LABR-${request.requestNumber}`,
      generatedAt: new Date(),
      request,
      verified: true,
    };
  }

  async statistics() {
    const [totalTests, activeTests, totalRequests, requested, collected, processing, completed, cancelled] =
      await Promise.all([
        this.prisma.labTest.count(),
        this.prisma.labTest.count({ where: { active: true } }),
        this.prisma.labRequest.count(),
        this.prisma.labRequest.count({ where: { status: 'REQUESTED' } }),
        this.prisma.labRequest.count({ where: { status: 'SAMPLE_COLLECTED' } }),
        this.prisma.labRequest.count({ where: { status: 'PROCESSING' } }),
        this.prisma.labRequest.count({ where: { status: 'COMPLETED' } }),
        this.prisma.labRequest.count({ where: { status: 'CANCELLED' } }),
      ]);
    return {
      totalTests, activeTests, totalRequests,
      requestsByStatus: { requested, sampleCollected: collected, processing, completed, cancelled },
    };
  }
}

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
      REQUESTED: ['SAMPLE_COLLECTED', 'CANCELLED'],
      SAMPLE_COLLECTED: ['PROCESSING', 'CANCELLED'],
      PROCESSING: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    };
    if (!allowed[current.status].includes(dto.status)) {
      throw new BadRequestException(`Cannot change laboratory request from ${current.status} to ${dto.status}`);
    }
    if (dto.status === 'COMPLETED') {
      const missing = current.items.filter((item) => !item.result || !item.result.resultValue?.trim());
      if (missing.length) {
        throw new BadRequestException('All requested tests must have a result before completion');
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
    };
    return this.prisma.labResult.upsert({
      where: { labRequestItemId: dto.labRequestItemId },
      create: { labRequestItemId: dto.labRequestItemId, ...data },
      update: data,
      include: { labRequestItem: { include: { labTest: true, labRequest: true } } },
    });
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

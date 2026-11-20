import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateMedicationAdministrationDto } from '../dto/create-medication-administration.dto.js';
import { CreateShiftHandoverDto } from '../dto/create-shift-handover.dto.js';
import { CreateNursingDischargeClearanceDto } from '../dto/create-nursing-discharge-clearance.dto.js';

@Injectable()
export class NursingCareWorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  private async nurseEmployee(userId: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      include: { user: { include: { role: true } } },
    });
    if (!employee) throw new ForbiddenException('Authenticated nurse is not linked to an employee record');
    if (!employee.isActive) throw new ForbiddenException('Nurse employee record is inactive');
    if (employee.user.role.name !== 'NURSE') throw new ForbiddenException('Authenticated employee is not linked to the NURSE role');
    return employee;
  }

  private async assertAssignedPatient(userId: number, patientId: number) {
    const employee = await this.nurseEmployee(userId);
    const assignment = await this.prisma.nursingAssignment.findFirst({
      where: { patientId, employeeId: employee.id, active: true },
      select: { id: true },
    });
    if (!assignment) throw new ForbiddenException(`You can only access patients assigned to you (userId ${userId}, employeeId ${employee.id}, patientId ${patientId})`);
    return employee;
  }

  async createMedication(dto: CreateMedicationAdministrationDto, userId: number, role: string) {
    const employee = role === 'NURSE' ? await this.assertAssignedPatient(userId, dto.patientId) : null;
    const prescription = await this.prisma.prescription.findUnique({
      where: { id: dto.prescriptionId },
      include: { patient: true },
    });
    if (!prescription) throw new NotFoundException('Prescription not found');
    if (prescription.patientId !== dto.patientId) throw new BadRequestException('Prescription does not belong to this patient');
    if (dto.status !== 'ADMINISTERED' && !dto.reason?.trim()) {
      throw new BadRequestException('A reason is required for missed or withheld medication');
    }
    const administeredAt = new Date(dto.administeredAt);
    if (Number.isNaN(administeredAt.getTime())) throw new BadRequestException('Invalid administration date and time');
    return this.prisma.medicationAdministration.create({
      data: {
        patientId: dto.patientId,
        prescriptionId: dto.prescriptionId,
        nurseUserId: userId,
        nurseEmployeeId: employee?.id ?? null,
        status: dto.status,
        administeredAt,
        reason: dto.reason?.trim() || null,
        notes: dto.notes?.trim() || null,
      },
      include: {
        patient: true,
        prescription: { include: { items: { include: { medicine: true } }, doctor: { include: { user: true } } } },
        nurseUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async medicationHistory(patientId: number, userId: number, role: string) {
    if (role === 'NURSE') await this.assertAssignedPatient(userId, patientId);
    return this.prisma.medicationAdministration.findMany({
      where: { patientId },
      include: {
        prescription: { include: { items: { include: { medicine: true } } } },
        nurseUser: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { administeredAt: 'desc' },
    });
  }

  async createHandover(dto: CreateShiftHandoverDto, userId: number, role: string) {
    if (role === 'NURSE') await this.assertAssignedPatient(userId, dto.patientId);
    const incoming = await this.prisma.user.findUnique({
      where: { id: dto.incomingNurseUserId },
      include: { role: true },
    });
    if (!incoming || incoming.role.name !== 'NURSE') throw new BadRequestException('Incoming nurse must be a valid NURSE account');
    if (dto.admissionId) {
      const admission = await this.prisma.admission.findUnique({
        where: { id: dto.admissionId },
        select: { id: true, patientId: true, status: true },
      });
      if (!admission) throw new NotFoundException('Admission not found');
      if (admission.patientId !== dto.patientId) throw new BadRequestException('Admission does not belong to this patient');
    }
    const handedOverAt = dto.handedOverAt ? new Date(dto.handedOverAt) : new Date();
    if (Number.isNaN(handedOverAt.getTime())) throw new BadRequestException('Invalid handover timestamp');
    return this.prisma.shiftHandover.create({
      data: {
        patientId: dto.patientId,
        admissionId: dto.admissionId ?? null,
        outgoingNurseUserId: userId,
        incomingNurseUserId: dto.incomingNurseUserId,
        patientSummary: dto.patientSummary.trim(),
        currentCondition: dto.currentCondition.trim(),
        pendingMedications: dto.pendingMedications?.trim() || null,
        pendingInvestigations: dto.pendingInvestigations?.trim() || null,
        importantObservations: dto.importantObservations?.trim() || null,
        escalationNotes: dto.escalationNotes?.trim() || null,
        handedOverAt,
      },
      include: {
        patient: true,
        outgoingNurseUser: { select: { id: true, firstName: true, lastName: true } },
        incomingNurseUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async handoverHistory(patientId: number, userId: number, role: string) {
    if (role === 'NURSE') await this.assertAssignedPatient(userId, patientId);
    return this.prisma.shiftHandover.findMany({
      where: { patientId },
      include: {
        outgoingNurseUser: { select: { id: true, firstName: true, lastName: true } },
        incomingNurseUser: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { handedOverAt: 'desc' },
    });
  }

  async createDischargeClearance(dto: CreateNursingDischargeClearanceDto, userId: number, role: string) {
    if (role === 'NURSE') await this.assertAssignedPatient(userId, dto.patientId);
    const admission = await this.prisma.admission.findUnique({
      where: { id: dto.admissionId },
      include: { patient: true },
    });
    if (!admission) throw new NotFoundException('Admission not found');
    if (admission.patientId !== dto.patientId) throw new BadRequestException('Admission does not belong to this patient');
    if (admission.status !== 'ADMITTED') throw new BadRequestException('Nursing clearance can only be recorded for an active admission');
    const existing = await this.prisma.nursingDischargeClearance.findUnique({ where: { admissionId: dto.admissionId } });
    if (existing) throw new ConflictException('Nursing discharge clearance already exists for this admission');
    const complete = dto.nursingClearance && dto.documentationComplete;
    return this.prisma.nursingDischargeClearance.create({
      data: {
        patientId: dto.patientId,
        admissionId: dto.admissionId,
        nurseUserId: userId,
        nursingDischargeNotes: dto.nursingDischargeNotes?.trim() || null,
        patientEducation: dto.patientEducation?.trim() || null,
        nursingClearance: dto.nursingClearance,
        documentationComplete: dto.documentationComplete,
        clearedAt: complete ? new Date() : null,
      },
    });
  }
}

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateMedicalRecordDto } from '../dto/create-medical-record.dto.js';
import { UpdateMedicalRecordDto } from '../dto/update-medical-record.dto.js';

@Injectable()
export class MedicalRecordService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertDoctorAccess(userId: number, doctorId: number) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { id: true, userId: true, active: true },
    });
    if (!doctor) throw new NotFoundException('Doctor not found');
    if (!doctor.active) throw new ForbiddenException('Doctor is inactive');
    if (doctor.userId !== userId) {
      throw new ForbiddenException('You can only access records assigned to you');
    }
    return doctor;
  }

  async create(dto: CreateMedicalRecordDto, userId: number, role: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: dto.patientId },
      select: { id: true },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const doctor = await this.prisma.doctor.findUnique({
      where: { id: dto.doctorId },
      select: { id: true, userId: true, active: true },
    });
    if (!doctor) throw new NotFoundException('Doctor not found');
    if (!doctor.active) throw new ForbiddenException('Doctor is inactive');
    if (role === 'DOCTOR' && doctor.userId !== userId) {
      throw new ForbiddenException('Doctors can only create records under their own profile');
    }

    if (dto.appointmentId !== undefined) {
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: dto.appointmentId },
        include: { patient: { select: { id: true } } },
      });
      if (!appointment) throw new NotFoundException('Appointment not found');
      if (appointment.patientId !== dto.patientId || appointment.doctorId !== dto.doctorId) {
        throw new ForbiddenException('The consultation must match the appointment patient and doctor');
      }
      if (role === 'DOCTOR' && appointment.doctorId !== doctor.id) {
        throw new ForbiddenException('You can only create consultations for your own appointments');
      }
      if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(appointment.status)) {
        throw new ForbiddenException('Cancelled, completed, or no-show appointments cannot start a consultation');
      }
      const existing = await this.prisma.medicalRecord.findUnique({
        where: { appointmentId: dto.appointmentId },
      });
      if (existing) throw new ConflictException('A consultation already exists for this appointment');
    }

    return this.prisma.medicalRecord.create({
      data: {
        patientId: dto.patientId,
        doctorId: dto.doctorId,
        appointmentId: dto.appointmentId,
        diagnosis: dto.diagnosis?.trim() || null,
        symptoms: dto.symptoms?.trim() || null,
        treatment: dto.treatment?.trim() || null,
        notes: dto.notes?.trim() || null,
        chiefComplaint: dto.chiefComplaint?.trim() || null,
        historyPresentIllness: dto.historyPresentIllness?.trim() || null,
        previousMedicalHistory: dto.previousMedicalHistory?.trim() || null,
        currentMedications: dto.currentMedications?.trim() || null,
        allergies: dto.allergies?.trim() || null,
        bloodPressure: dto.bloodPressure?.trim() || null,
        pulse: dto.pulse?.trim() || null,
        temperature: dto.temperature?.trim() || null,
        respiratoryRate: dto.respiratoryRate?.trim() || null,
        oxygenSaturation: dto.oxygenSaturation?.trim() || null,
        weight: dto.weight?.trim() || null,
        height: dto.height?.trim() || null,
        physicalExamination: dto.physicalExamination?.trim() || null,
        followUpRecommendations: dto.followUpRecommendations?.trim() || null,
      },
      include: {
        patient: true,
        doctor: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
      },
    });
  }

  async findAll(filters: { patientId?: number; doctorId?: number }, userId: number, role: string) {
    let doctorFilter = filters.doctorId;
    if (role === 'DOCTOR') {
      const ownDoctor = await this.prisma.doctor.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!ownDoctor) throw new ForbiddenException('No doctor profile is linked to this account');
      if (doctorFilter !== undefined && doctorFilter !== ownDoctor.id) {
        throw new ForbiddenException('You can only view your own medical records');
      }
      doctorFilter = ownDoctor.id;
    }

    return this.prisma.medicalRecord.findMany({
      where: {
        ...(filters.patientId !== undefined ? { patientId: filters.patientId } : {}),
        ...(doctorFilter !== undefined ? { doctorId: doctorFilter } : {}),
      },
      include: {
        patient: true,
        doctor: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, userId: number, role: string) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        prescriptions: { include: { items: true } },
        labRequests: { include: { items: { include: { labTest: true, result: true } } } },
      },
    });
    if (!record) throw new NotFoundException('Medical record not found');
    if (role === 'DOCTOR' && record.doctor.userId !== userId) {
      throw new ForbiddenException('You can only view records assigned to you');
    }
    return record;
  }

  async patientHistory(patientId: number, userId: number, role: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    const records = await this.findAll({ patientId }, userId, role);
    return {
      patientId,
      totalRecords: records.length,
      records,
    };
  }

  async update(id: number, dto: UpdateMedicalRecordDto, userId: number, role: string) {
    const current = await this.findOne(id, userId, role);
    return this.prisma.medicalRecord.update({
      where: { id: current.id },
      data: {
        ...(dto.diagnosis !== undefined ? { diagnosis: dto.diagnosis?.trim() || null } : {}),
        ...(dto.symptoms !== undefined ? { symptoms: dto.symptoms?.trim() || null } : {}),
        ...(dto.treatment !== undefined ? { treatment: dto.treatment?.trim() || null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        ...(dto.chiefComplaint !== undefined ? { chiefComplaint: dto.chiefComplaint?.trim() || null } : {}),
        ...(dto.historyPresentIllness !== undefined ? { historyPresentIllness: dto.historyPresentIllness?.trim() || null } : {}),
        ...(dto.previousMedicalHistory !== undefined ? { previousMedicalHistory: dto.previousMedicalHistory?.trim() || null } : {}),
        ...(dto.currentMedications !== undefined ? { currentMedications: dto.currentMedications?.trim() || null } : {}),
        ...(dto.allergies !== undefined ? { allergies: dto.allergies?.trim() || null } : {}),
        ...(dto.bloodPressure !== undefined ? { bloodPressure: dto.bloodPressure?.trim() || null } : {}),
        ...(dto.pulse !== undefined ? { pulse: dto.pulse?.trim() || null } : {}),
        ...(dto.temperature !== undefined ? { temperature: dto.temperature?.trim() || null } : {}),
        ...(dto.respiratoryRate !== undefined ? { respiratoryRate: dto.respiratoryRate?.trim() || null } : {}),
        ...(dto.oxygenSaturation !== undefined ? { oxygenSaturation: dto.oxygenSaturation?.trim() || null } : {}),
        ...(dto.weight !== undefined ? { weight: dto.weight?.trim() || null } : {}),
        ...(dto.height !== undefined ? { height: dto.height?.trim() || null } : {}),
        ...(dto.physicalExamination !== undefined ? { physicalExamination: dto.physicalExamination?.trim() || null } : {}),
        ...(dto.followUpRecommendations !== undefined ? { followUpRecommendations: dto.followUpRecommendations?.trim() || null } : {}),
      },
      include: {
        patient: true,
        doctor: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });
  }

  async statistics(userId: number, role: string) {
    const where = role === 'DOCTOR'
      ? { doctor: { userId } }
      : {};
    const [total, latest] = await Promise.all([
      this.prisma.medicalRecord.count({ where }),
      this.prisma.medicalRecord.findMany({
        where,
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          diagnosis: true,
          createdAt: true,
          patient: { select: { id: true, patientNumber: true, firstName: true, lastName: true } },
        },
      }),
    ]);
    return { totalRecords: total, latestRecords: latest };
  }
}

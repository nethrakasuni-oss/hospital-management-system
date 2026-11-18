import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSurgeryBookingDto } from './dto/create-surgery-booking.dto.js';
import { UpdateSurgeryBookingDto } from './dto/update-surgery-booking.dto.js';

@Injectable()
export class SurgeryService {
  constructor(private readonly prisma: PrismaService) {}
  private bookingNo() { return `SUR-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`; }

  private async ensureSlot(start: Date, end: Date, theatreId: number, doctorId: number, excludeId?: number) {
    if (!(start < end)) throw new BadRequestException('plannedEndAt must be later than plannedStartAt');
    const overlap = { lt: end };
    const common = { status: { in: ['SCHEDULED', 'PREPARATION', 'IN_PROGRESS'] as never[] }, plannedStartAt: overlap, plannedEndAt: { gt: start }, ...(excludeId ? { id: { not: excludeId } } : {}) };
    const [theatreConflict, doctorConflict] = await Promise.all([
      this.prisma.surgeryBooking.findFirst({ where: { ...common, theatreId } }),
      this.prisma.surgeryBooking.findFirst({ where: { ...common, doctorId } }),
    ]);
    if (theatreConflict) throw new ConflictException('The operation theatre is already booked for this time');
    if (doctorConflict) throw new ConflictException('The doctor already has a surgery booking during this time');
  }

  async create(dto: CreateSurgeryBookingDto) {
    const start = new Date(dto.plannedStartAt), end = new Date(dto.plannedEndAt);
    await this.ensureSlot(start, end, dto.theatreId, dto.doctorId);
    const [patient, doctor, theatre] = await Promise.all([
      this.prisma.patient.findUnique({ where: { id: dto.patientId } }),
      this.prisma.doctor.findUnique({ where: { id: dto.doctorId } }),
      this.prisma.operationTheatre.findUnique({ where: { id: dto.theatreId } }),
    ]);
    if (!patient) throw new NotFoundException('Patient not found');
    if (!doctor || !doctor.active) throw new NotFoundException('Active doctor not found');
    if (!theatre || !theatre.isActive || theatre.status !== 'AVAILABLE') throw new ConflictException('Operation theatre is not available');
    if (dto.admissionId && !await this.prisma.admission.findUnique({ where: { id: dto.admissionId } })) throw new NotFoundException('Admission not found');
    return this.prisma.surgeryBooking.create({
      data: { bookingNumber: this.bookingNo(), procedureName: dto.procedureName, plannedStartAt: start, plannedEndAt: end,
        patientId: dto.patientId, doctorId: dto.doctorId, theatreId: dto.theatreId,
        ...(dto.admissionId ? { admissionId: dto.admissionId } : {}),
        ...(dto.preOpNotes ? { preOpNotes: dto.preOpNotes } : {}) },
      include: { patient: true, doctor: { include: { user: true } }, theatre: true, admission: true },
    });
  }

  findAll(filters: { patientId?: number; doctorId?: number; theatreId?: number; status?: string; from?: string; to?: string }) {
    return this.prisma.surgeryBooking.findMany({
      where: { ...(filters.patientId ? { patientId: filters.patientId } : {}), ...(filters.doctorId ? { doctorId: filters.doctorId } : {}),
        ...(filters.theatreId ? { theatreId: filters.theatreId } : {}), ...(filters.status ? { status: filters.status as never } : {}),
        ...(filters.from || filters.to ? { plannedStartAt: { ...(filters.from ? { gte: new Date(filters.from) } : {}), ...(filters.to ? { lte: new Date(filters.to) } : {}) } } : {}) },
      include: { patient: true, doctor: { include: { user: true } }, theatre: true }, orderBy: { plannedStartAt: 'asc' },
    });
  }

  async findOne(id: number) {
    const row = await this.prisma.surgeryBooking.findUnique({ where: { id }, include: { patient: true, doctor: { include: { user: true } }, theatre: true, admission: true } });
    if (!row) throw new NotFoundException('Surgery booking not found');
    return row;
  }

  async update(id: number, dto: UpdateSurgeryBookingDto) {
    const current = await this.findOne(id);
    if (!['SCHEDULED', 'PREPARATION'].includes(current.status)) throw new BadRequestException('Only scheduled or preparation bookings can be edited');
    const start = dto.plannedStartAt ? new Date(dto.plannedStartAt) : current.plannedStartAt;
    const end = dto.plannedEndAt ? new Date(dto.plannedEndAt) : current.plannedEndAt;
    await this.ensureSlot(start, end, current.theatreId, current.doctorId, id);
    return this.prisma.surgeryBooking.update({ where: { id }, data: { ...dto, plannedStartAt: start, plannedEndAt: end }, include: { patient: true, doctor: true, theatre: true } });
  }

  async transition(id: number, status: string, notes?: string, reason?: string) {
    const row = await this.findOne(id);
    const allowed: Record<string, string[]> = {
      PREPARATION: ['SCHEDULED'], IN_PROGRESS: ['PREPARATION'], COMPLETED: ['IN_PROGRESS'],
      CANCELLED: ['SCHEDULED', 'PREPARATION'], POSTPONED: ['SCHEDULED', 'PREPARATION'],
    };
    if (!allowed[status]?.includes(row.status)) throw new BadRequestException(`Cannot change surgery from ${row.status} to ${status}`);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.surgeryBooking.update({
        where: { id },
        data: { status: status as never, ...(status === 'IN_PROGRESS' ? { actualStartAt: new Date() } : {}),
          ...(status === 'COMPLETED' ? { actualEndAt: new Date(), ...(notes ? { postOpNotes: notes } : {}) } : {}),
          ...(status === 'CANCELLED' || status === 'POSTPONED' ? { cancellationReason: reason ?? null } : {}) },
        include: { patient: true, doctor: true, theatre: true },
      });
      if (status === 'IN_PROGRESS') await tx.operationTheatre.update({ where: { id: row.theatreId }, data: { status: 'IN_USE' } });
      if (['COMPLETED', 'CANCELLED', 'POSTPONED'].includes(status)) {
        const next = await tx.surgeryBooking.count({ where: { theatreId: row.theatreId, id: { not: id }, status: 'IN_PROGRESS' } });
        if (!next) await tx.operationTheatre.updateMany({ where: { id: row.theatreId, status: 'IN_USE' }, data: { status: 'AVAILABLE' } });
      }
      return updated;
    });
  }
}

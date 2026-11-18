
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateWardDto } from './dto/create-ward.dto.js';
import { UpdateWardDto } from './dto/update-ward.dto.js';
import { CreateRoomDto } from './dto/create-room.dto.js';
import { CreateBedDto } from './dto/create-bed.dto.js';
import { UpdateBedDto } from './dto/update-bed.dto.js';
import { CreateAdmissionDto } from './dto/create-admission.dto.js';

@Injectable()
export class InpatientService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================
  // WARD MANAGEMENT
  // =========================

  async createWard(dto: CreateWardDto) {
    const name = dto.name.trim();

    const existing = await this.prisma.ward.findUnique({
      where: { name },
    });

    if (existing) {
      throw new ConflictException('Ward name already exists');
    }

    if (dto.departmentId !== undefined) {
      const department = await this.prisma.department.findUnique({
        where: { id: dto.departmentId },
      });

      if (!department) {
        throw new NotFoundException('Department not found');
      }
    }

    return this.prisma.ward.create({
      data: {
        name,
        description: dto.description?.trim(),
        departmentId: dto.departmentId ?? null,
      },
      include: {
        department: true,
        rooms: true,
      },
    });
  }

  findAllWards() {
    return this.prisma.ward.findMany({
      include: {
        department: true,
        rooms: {
          include: {
            beds: {
              include: {
                admissions: {
                  where: { status: 'ADMITTED' },
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findWard(id: number) {
    const ward = await this.prisma.ward.findUnique({
      where: { id },
      include: {
        department: true,
        rooms: {
          include: {
            beds: {
              include: {
                admissions: {
                  where: { status: 'ADMITTED' },
                  include: { patient: true },
                },
              },
            },
          },
        },
      },
    });

    if (!ward) {
      throw new NotFoundException('Ward not found');
    }

    return ward;
  }

  async updateWard(id: number, dto: UpdateWardDto) {
    await this.findWard(id);

    const data: {
      name?: string;
      description?: string | null;
      departmentId?: number | null;
    } = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();

      const duplicate = await this.prisma.ward.findFirst({
        where: { name, NOT: { id } },
      });

      if (duplicate) {
        throw new ConflictException('Ward name already exists');
      }

      data.name = name;
    }

    if (dto.description !== undefined) {
      data.description = dto.description?.trim() || null;
    }

    if (dto.departmentId !== undefined) {
      if (dto.departmentId !== null) {
        const department = await this.prisma.department.findUnique({
          where: { id: dto.departmentId },
        });

        if (!department) {
          throw new NotFoundException('Department not found');
        }
      }

      data.departmentId = dto.departmentId;
    }

    return this.prisma.ward.update({
      where: { id },
      data,
      include: { department: true, rooms: true },
    });
  }

  // =========================
  // ROOM MANAGEMENT
  // =========================

  async createRoom(dto: CreateRoomDto) {
    const ward = await this.prisma.ward.findUnique({
      where: { id: dto.wardId },
    });

    if (!ward) {
      throw new NotFoundException('Ward not found');
    }

    const roomNumber = dto.roomNumber.trim();

    const existing = await this.prisma.room.findFirst({
      where: {
        wardId: dto.wardId,
        roomNumber,
      },
    });

    if (existing) {
      throw new ConflictException(
        'Room number already exists in this ward',
      );
    }

    return this.prisma.room.create({
      data: {
        roomNumber,
        wardId: dto.wardId,
      },
      include: {
        ward: true,
        beds: true,
      },
    });
  }

  findAllRooms(wardId?: number) {
    return this.prisma.room.findMany({
      where: wardId !== undefined ? { wardId } : {},
      include: {
        ward: true,
        beds: {
          include: {
            admissions: {
              where: { status: 'ADMITTED' },
              include: { patient: true },
            },
          },
        },
      },
      orderBy: [
        { wardId: 'asc' },
        { roomNumber: 'asc' },
      ],
    });
  }

  // =========================
  // BED MANAGEMENT
  // =========================

  async createBed(dto: CreateBedDto) {
    const room = await this.prisma.room.findUnique({
      where: { id: dto.roomId },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const bedNumber = dto.bedNumber.trim();

    const existing = await this.prisma.bed.findFirst({
      where: {
        roomId: dto.roomId,
        bedNumber,
      },
    });

    if (existing) {
      throw new ConflictException(
        'Bed number already exists in this room',
      );
    }

    return this.prisma.bed.create({
      data: {
        bedNumber,
        roomId: dto.roomId,
        status: 'AVAILABLE',
      },
      include: {
        room: { include: { ward: true } },
      },
    });
  }

  findAllBeds(wardId?: number, roomId?: number, status?: string) {
    return this.prisma.bed.findMany({
      where: {
        ...(roomId !== undefined ? { roomId } : {}),
        ...(wardId !== undefined ? { room: { wardId } } : {}),
        ...(status ? { status: status as never } : {}),
      },
      include: {
        room: {
          include: {
            ward: true,
          },
        },
        admissions: {
          where: { status: 'ADMITTED' },
          include: { patient: true },
        },
      },
      orderBy: [
        { roomId: 'asc' },
        { bedNumber: 'asc' },
      ],
    });
  }

  async updateBed(id: number, dto: UpdateBedDto) {
    const bed = await this.prisma.bed.findUnique({
      where: { id },
      include: {
        admissions: {
          where: { status: 'ADMITTED' },
        },
      },
    });

    if (!bed) {
      throw new NotFoundException('Bed not found');
    }

    if (dto.status === undefined) {
      throw new BadRequestException('Bed status is required');
    }

    if (bed.admissions.length > 0) {
      throw new ConflictException(
        'Cannot change the status of a bed assigned to an admitted patient',
      );
    }

    if (bed.status === 'OCCUPIED') {
      throw new ConflictException(
        'Occupied bed status must be changed through admission or discharge operations',
      );
    }

    return this.prisma.bed.update({
      where: { id },
      data: { status: dto.status as never },
      include: {
        room: { include: { ward: true } },
      },
    });
  }

  // =========================
  // ADMISSION MANAGEMENT
  // =========================

  async createAdmission(dto: CreateAdmissionDto) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: dto.patientId },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const admissionDate = dto.admissionDate
      ? new Date(dto.admissionDate)
      : new Date();

    if (Number.isNaN(admissionDate.getTime())) {
      throw new BadRequestException('Invalid admission date');
    }

    if (admissionDate > new Date()) {
      throw new BadRequestException(
        'Admission date cannot be in the future',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const activeAdmission = await tx.admission.findFirst({
        where: {
          patientId: dto.patientId,
          status: 'ADMITTED',
        },
      });

      if (activeAdmission) {
        throw new ConflictException(
          'Patient already has an active admission',
        );
      }

      const bed = await tx.bed.findUnique({
        where: { id: dto.bedId },
        include: {
          room: { include: { ward: true } },
        },
      });

      if (!bed) {
        throw new NotFoundException('Bed not found');
      }

      if (bed.status !== 'AVAILABLE') {
        throw new ConflictException(
          'Selected bed is not available',
        );
      }

      const allocation = await tx.bed.updateMany({
        where: {
          id: dto.bedId,
          status: 'AVAILABLE',
        },
        data: {
          status: 'OCCUPIED',
        },
      });

      if (allocation.count !== 1) {
        throw new ConflictException(
          'Bed was allocated to another patient. Please select another bed',
        );
      }

      const admission = await tx.admission.create({
        data: {
          patientId: dto.patientId,
          bedId: dto.bedId,
          admissionDate,
          reason: dto.reason?.trim() || null,
          status: 'ADMITTED',
        },
        include: {
          patient: true,
          bed: {
            include: {
              room: {
                include: { ward: true },
              },
            },
          },
        },
      });

      return admission;
    });
  }

  findAllAdmissions(patientId?: number, status?: string) {
    return this.prisma.admission.findMany({
      where: {
        ...(patientId !== undefined ? { patientId } : {}),
        ...(status ? { status: status as never } : {}),
      },
      include: {
        patient: true,
        bed: {
          include: {
            room: {
              include: { ward: true },
            },
          },
        },
        dischargeSummary: true,
      },
      orderBy: { admissionDate: 'desc' },
    });
  }

  async findAdmission(id: number) {
    const admission = await this.prisma.admission.findUnique({
      where: { id },
      include: {
        patient: true,
        bed: {
          include: {
            room: {
              include: { ward: true },
            },
          },
        },
        dischargeSummary: true,
        transfers: true,
        nursingAssignments: true,
      },
    });

    if (!admission) {
      throw new NotFoundException('Admission not found');
    }

    return admission;
  }

  // =========================
  // DASHBOARD STATISTICS
  // =========================

  async dashboardStatistics() {
    const [
      totalWards,
      totalRooms,
      totalBeds,
      availableBeds,
      occupiedBeds,
      maintenanceBeds,
      unavailableBeds,
      activeAdmissions,
      dischargedAdmissions,
    ] = await Promise.all([
      this.prisma.ward.count(),
      this.prisma.room.count(),
      this.prisma.bed.count(),
      this.prisma.bed.count({ where: { status: 'AVAILABLE' } }),
      this.prisma.bed.count({ where: { status: 'OCCUPIED' } }),
      this.prisma.bed.count({ where: { status: 'MAINTENANCE' } }),
      this.prisma.bed.count({ where: { status: 'UNAVAILABLE' } }),
      this.prisma.admission.count({ where: { status: 'ADMITTED' } }),
      this.prisma.admission.count({ where: { status: 'DISCHARGED' } }),
    ]);

    return {
      totalWards,
      totalRooms,
      totalBeds,
      availableBeds,
      occupiedBeds,
      maintenanceBeds,
      unavailableBeds,
      activeAdmissions,
      dischargedAdmissions,
      occupancyRate: totalBeds > 0
        ? Number(((occupiedBeds / totalBeds) * 100).toFixed(2))
        : 0,
    };
  }
}

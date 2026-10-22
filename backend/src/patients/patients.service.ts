import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePatientDto } from './dto/create-patient.dto.js';
import { UpdatePatientDto } from './dto/update-patient.dto.js';

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePatientDto) {
    const existingPatient = await this.prisma.patient.findUnique({
      where: {
        patientNumber: dto.patientNumber,
      },
    });

    if (existingPatient) {
      throw new ConflictException('Patient number already exists');
    }

    return this.prisma.patient.create({
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth
          ? new Date(dto.dateOfBirth)
          : undefined,
      },
    });
  }

  findAll() {
    return this.prisma.patient.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number) {
    const patient = await this.prisma.patient.findUnique({
      where: {
        id,
      },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    return patient;
  }

  async update(id: number, dto: UpdatePatientDto) {
    await this.findOne(id);

    return this.prisma.patient.update({
      where: {
        id,
      },

      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth
          ? new Date(dto.dateOfBirth)
          : undefined,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.patient.delete({
      where: {
        id,
      },
    });
  }

  search(search: string) {
    return this.prisma.patient.findMany({
      where: {
        OR: [
          {
            patientNumber: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            firstName: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            lastName: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            phone: {
              contains: search,
            },
          },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
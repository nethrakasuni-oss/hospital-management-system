
import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateDoctorDto } from '../dto/create-doctor.dto.js';
import { UpdateDoctorDto } from '../dto/update-doctor.dto.js';

@Injectable()
export class DoctorProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDoctorDto) {
    const [existingUser, existingDoctor, doctorRole] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { email: dto.email },
        }),
        this.prisma.doctor.findUnique({
          where: { registrationNo: dto.registrationNo },
        }),
        this.prisma.role.findUnique({
          where: { name: 'DOCTOR' },
        }),
      ]);

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    if (existingDoctor) {
      throw new ConflictException(
        'Registration number already exists',
      );
    }

    if (!doctorRole) {
      throw new BadRequestException('DOCTOR role not found');
    }

    if (dto.departmentId !== undefined) {
      const department = await this.prisma.department.findUnique({
        where: { id: dto.departmentId },
      });

      if (!department) {
        throw new NotFoundException('Department not found');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: dto.email,
            passwordHash,
            firstName: dto.firstName,
            lastName: dto.lastName,
            phone: dto.phone,
            roleId: doctorRole.id,
          },
        });

        return tx.doctor.create({
          data: {
            registrationNo: dto.registrationNo,
            specialization: dto.specialization,
            qualification: dto.qualification,
            biography: dto.biography,
            yearsExperience: dto.yearsExperience,
            profilePhotoUrl: dto.profilePhotoUrl,
            licenseExpiry: dto.licenseExpiry
              ? new Date(dto.licenseExpiry)
              : undefined,
            languages: dto.languages ?? [],
            consultationFee: dto.consultationFee,
            currency: dto.currency ?? 'LKR',
            departmentId: dto.departmentId,
            userId: user.id,
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                status: true,
              },
            },
            department: true,
          },
        });
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'Email or registration number already exists',
        );
      }
      throw error;
    }
  }

  async findAll() {
    return this.prisma.doctor.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            status: true,
          },
        },
        department: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            status: true,
          },
        },
        department: true,
        schedules: true,
        availability: true,
        leaves: true,
      },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    return doctor;
  }

  async update(id: number, dto: UpdateDoctorDto) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    if (dto.departmentId !== undefined) {
      const department = await this.prisma.department.findUnique({
        where: { id: dto.departmentId },
      });

      if (!department) {
        throw new NotFoundException('Department not found');
      }
    }

    const {
      email,
      firstName,
      lastName,
      phone,
      ...doctorData
    } = dto;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const userData = {
          ...(email !== undefined ? { email } : {}),
          ...(firstName !== undefined ? { firstName } : {}),
          ...(lastName !== undefined ? { lastName } : {}),
          ...(phone !== undefined ? { phone } : {}),
        };

        if (Object.keys(userData).length > 0) {
          await tx.user.update({
            where: { id: doctor.userId },
            data: userData,
          });
        }

        return tx.doctor.update({
          where: { id },
          data: {
            ...doctorData,
            ...(dto.licenseExpiry !== undefined
              ? {
                  licenseExpiry: dto.licenseExpiry
                    ? new Date(dto.licenseExpiry)
                    : null,
                }
              : {}),
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                status: true,
              },
            },
            department: true,
          },
        });
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'Email or registration number already exists',
        );
      }
      throw error;
    }
  }

  async deactivate(id: number) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: doctor.userId },
        data: { status: 'INACTIVE' },
      });

      return tx.doctor.update({
        where: { id },
        data: { active: false },
      });
    });
  }

  async reactivate(id: number) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    if (doctor.user.status === 'SUSPENDED') {
      throw new BadRequestException(
        'A suspended account cannot be reactivated through this operation',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: doctor.userId },
        data: { status: 'ACTIVE' },
      });

      return tx.doctor.update({
        where: { id },
        data: { active: true },
      });
    });
  }
}


import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateStaffDto } from './dto/create-staff.dto.js';

@Injectable()
export class StaffRegistrationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateStaffDto, actorId: number, ip?: string) {
    const email = dto.email.trim().toLowerCase();
    const roleName = dto.role.trim().toUpperCase();

    const allowedRoles = [
      'ADMIN',
      'DOCTOR',
      'NURSE',
      'RECEPTIONIST',
      'LAB_TECHNICIAN',
      'PHARMACIST',
      'ACCOUNTANT',
      'HR_MANAGER',
      'INVENTORY_MANAGER',
    ];

    if (!allowedRoles.includes(roleName)) {
      throw new BadRequestException('Unsupported staff role');
    }

    if (roleName === 'DOCTOR' && !dto.registrationNo?.trim()) {
      throw new BadRequestException(
        'Doctor registration number is required',
      );
    }

    if (
      roleName !== 'DOCTOR' &&
      roleName !== 'ADMIN' &&
      (!dto.employeeNo?.trim() || !dto.designation?.trim())
    ) {
      throw new BadRequestException(
        'Employee number and designation are required',
      );
    }

    if (dto.departmentId !== undefined) {
      const department = await this.prisma.department.findUnique({
        where: { id: dto.departmentId },
        select: { id: true },
      });

      if (!department) {
        throw new NotFoundException('Department not found');
      }
    }

    const [existingUser, role] = await Promise.all([
      this.prisma.user.findUnique({ where: { email } }),
      this.prisma.role.findUnique({ where: { name: roleName } }),
    ]);

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    if (!role) {
      throw new BadRequestException(
        `Role ${roleName} does not exist in the database`,
      );
    }

    if (roleName === 'DOCTOR') {
      const existingDoctor = await this.prisma.doctor.findUnique({
        where: { registrationNo: dto.registrationNo!.trim() },
      });

      if (existingDoctor) {
        throw new ConflictException(
          'Doctor registration number already exists',
        );
      }
    }

    if (roleName !== 'DOCTOR' && roleName !== 'ADMIN') {
      const existingEmployee = await this.prisma.employee.findUnique({
        where: { employeeNo: dto.employeeNo!.trim() },
      });

      if (existingEmployee) {
        throw new ConflictException('Employee number already exists');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            phone: dto.phone?.trim() || null,
            roleId: role.id,
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            status: true,
            role: {
              select: { id: true, name: true },
            },
          },
        });

        let profile: unknown = null;

        if (roleName === 'DOCTOR') {
          profile = await tx.doctor.create({
            data: {
              registrationNo: dto.registrationNo!.trim(),
              specialization: dto.specialization?.trim() || null,
              qualification: dto.qualification?.trim() || null,
              consultationFee: dto.consultationFee ?? 0,
              currency: 'LKR',
              departmentId: dto.departmentId ?? null,
              userId: user.id,
            },
          });
        } else if (roleName !== 'ADMIN') {
          profile = await tx.employee.create({
            data: {
              userId: user.id,
              employeeNo: dto.employeeNo!.trim(),
              designation: dto.designation!.trim(),
              joinedDate: dto.joinedDate
                ? new Date(dto.joinedDate)
                : null,
              departmentId: dto.departmentId ?? null,
            },
          });
        }

        return { user, profile };
      });

      await this.prisma.auditLog.create({
        data: {
          userId: actorId,
          action: 'CREATE',
          entity: 'StaffAccount',
          entityId: String(result.user.id),
          oldData: Prisma.JsonNull,
          newData: {
            userId: result.user.id,
            email: result.user.email,
            role: roleName,
            profileCreated: result.profile !== null,
          },
          ipAddress: ip?.slice(0, 64) ?? null,
        },
      });

      return {
        message: 'Staff account created successfully',
        ...result,
      };
    } catch (error) {
      const code = (error as { code?: string })?.code;

      if (code === 'P2002') {
        throw new ConflictException(
          'Email, employee number or registration number already exists',
        );
      }

      throw error;
    }
  }
}

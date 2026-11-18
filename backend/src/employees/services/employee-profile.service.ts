import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateEmployeeDto } from '../dto/create-employee.dto.js';
import { UpdateEmployeeDto } from '../dto/update-employee.dto.js';

@Injectable()
export class EmployeeProfileService {
  constructor(private readonly prisma: PrismaService) {}

  private handlePrismaError(error: unknown): never {
    const prismaError = error as { code?: string };

    if (prismaError?.code === 'P2002') {
      throw new ConflictException(
        'Employee number or user account is already linked to an employee',
      );
    }

    if (prismaError?.code === 'P2003') {
      throw new NotFoundException(
        'The referenced user or department does not exist',
      );
    }

    throw error;
  }

  async create(dto: CreateEmployeeDto) {
    try {
      return await this.prisma.employee.create({
        data: {
          userId: dto.userId,
          employeeNo: dto.employeeNo.trim(),
          designation: dto.designation.trim(),
          joinedDate: dto.joinedDate ? new Date(dto.joinedDate) : null,
          departmentId: dto.departmentId ?? null,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          department: true,
        },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findAll() {
    return this.prisma.employee.findMany({
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        department: true,
        headsDepartment: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        _count: {
          select: {
            attendanceRecords: true,
            leaveRecords: true,
          },
        },
      },
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        department: true,
        headsDepartment: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        attendanceRecords: true,
        leaveRecords: true,
        _count: {
          select: {
            attendanceRecords: true,
            leaveRecords: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return employee;
  }

  async update(id: number, dto: UpdateEmployeeDto) {
    await this.findOne(id);

    try {
      return await this.prisma.employee.update({
        where: { id },
        data: {
          ...(dto.employeeNo !== undefined
            ? { employeeNo: dto.employeeNo.trim() }
            : {}),
          ...(dto.designation !== undefined
            ? { designation: dto.designation.trim() }
            : {}),
          ...(dto.joinedDate !== undefined
            ? {
                joinedDate: dto.joinedDate
                  ? new Date(dto.joinedDate)
                  : null,
              }
            : {}),
          ...(dto.departmentId !== undefined
            ? { departmentId: dto.departmentId }
            : {}),
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          department: true,
        },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async updateStatus(id: number, isActive: boolean) {
    await this.findOne(id);

    return this.prisma.employee.update({
      where: { id },
      data: { isActive },
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    const [attendanceCount, leaveCount, headDepartment] =
      await Promise.all([
        this.prisma.attendance.count({ where: { employeeId: id } }),
        this.prisma.leaveRecord.count({ where: { employeeId: id } }),
        this.prisma.department.findFirst({
          where: { headEmployeeId: id },
          select: { id: true },
        }),
      ]);

    if (attendanceCount > 0 || leaveCount > 0 || headDepartment) {
      throw new ConflictException(
        'Employee has linked attendance, leave, or department-head records. Deactivate the employee instead of deleting it.',
      );
    }

    return this.prisma.employee.delete({ where: { id } });
  }
}

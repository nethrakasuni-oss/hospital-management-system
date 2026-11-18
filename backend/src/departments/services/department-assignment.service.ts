
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import { AssignDepartmentHeadDto } from '../dto/assign-department-head.dto.js';
import { AssignDoctorDto } from '../dto/assign-doctor.dto.js';

@Injectable()
export class DepartmentAssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  private async getActiveDepartment(departmentId: number) {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    if (!department.isActive) {
      throw new BadRequestException(
        'Cannot assign staff to an inactive department',
      );
    }

    return department;
  }

  // ==========================================
  // DEPARTMENT HEAD MANAGEMENT
  // ==========================================

  async assignDepartmentHead(
    departmentId: number,
    dto: AssignDepartmentHeadDto,
  ) {
    await this.getActiveDepartment(departmentId);

    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
      include: {
        headsDepartment: true,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (employee.departmentId !== departmentId) {
      throw new BadRequestException(
        'Department head must belong to the selected department',
      );
    }

    if (
      employee.headsDepartment &&
      employee.headsDepartment.id !== departmentId
    ) {
      throw new ConflictException(
        'Employee is already the head of another department',
      );
    }

    const existingHead =
      await this.prisma.department.findUnique({
        where: { headEmployeeId: dto.employeeId },
      });

    if (
      existingHead &&
      existingHead.id !== departmentId
    ) {
      throw new ConflictException(
        'Employee is already assigned as another department head',
      );
    }

    return this.prisma.department.update({
      where: { id: departmentId },
      data: {
        headEmployeeId: dto.employeeId,
      },
      include: {
        headEmployee: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  async removeDepartmentHead(departmentId: number) {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    if (department.headEmployeeId === null) {
      throw new BadRequestException(
        'This department does not have a department head',
      );
    }

    return this.prisma.department.update({
      where: { id: departmentId },
      data: {
        headEmployeeId: null,
      },
    });
  }

  // ==========================================
  // DOCTOR ASSIGNMENT
  // ==========================================

  async assignDoctor(
    departmentId: number,
    dto: AssignDoctorDto,
  ) {
    await this.getActiveDepartment(departmentId);

    const doctor = await this.prisma.doctor.findUnique({
      where: { id: dto.doctorId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    if (!doctor.active) {
      throw new BadRequestException(
        'Cannot assign an inactive doctor',
      );
    }

    return this.prisma.doctor.update({
      where: { id: dto.doctorId },
      data: {
        departmentId,
      },
      include: {
        department: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async removeDoctor(
    departmentId: number,
    doctorId: number,
  ) {
    await this.getActiveDepartment(departmentId);

    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    if (doctor.departmentId !== departmentId) {
      throw new BadRequestException(
        'Doctor does not belong to this department',
      );
    }

    return this.prisma.doctor.update({
      where: { id: doctorId },
      data: {
        departmentId: null,
      },
    });
  }

  // ==========================================
  // EMPLOYEE ASSIGNMENT
  // ==========================================

  async assignEmployee(
    departmentId: number,
    employeeId: number,
  ) {
    await this.getActiveDepartment(departmentId);

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        departmentId,
      },
      include: {
        department: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async removeEmployee(
    departmentId: number,
    employeeId: number,
  ) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (employee.departmentId !== departmentId) {
      throw new BadRequestException(
        'Employee does not belong to this department',
      );
    }

    if (
      (await this.prisma.department.findUnique({
        where: { id: departmentId },
        select: { headEmployeeId: true },
      }))?.headEmployeeId === employeeId
    ) {
      throw new BadRequestException(
        'Remove the employee as department head before transferring them',
      );
    }

    return this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        departmentId: null,
      },
    });
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import { AssignEmployeeDepartmentDto } from '../dto/assign-employee-department.dto.js';

@Injectable()
export class EmployeeAssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  async assignDepartment(
    employeeId: number,
    dto: AssignEmployeeDepartmentDto,
  ) {
    const [employee, department] = await Promise.all([
      this.prisma.employee.findUnique({ where: { id: employeeId } }),
      this.prisma.department.findUnique({
        where: { id: dto.departmentId },
      }),
    ]);

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    if (!department.isActive) {
      throw new BadRequestException(
        'Cannot assign an employee to an inactive department',
      );
    }

    return this.prisma.employee.update({
      where: { id: employeeId },
      data: { departmentId: dto.departmentId },
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

  async removeDepartment(employeeId: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const departmentHead = await this.prisma.department.findFirst({
      where: { headEmployeeId: employeeId },
      select: { id: true, name: true },
    });

    if (departmentHead) {
      throw new BadRequestException(
        `Remove this employee as head of ${departmentHead.name} before removing the department assignment`,
      );
    }

    return this.prisma.employee.update({
      where: { id: employeeId },
      data: { departmentId: null },
      include: { department: true },
    });
  }

  async assignAsDepartmentHead(
    employeeId: number,
    departmentId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findUnique({
        where: { id: employeeId },
      });

      if (!employee) {
        throw new NotFoundException('Employee not found');
      }

      const department = await tx.department.findUnique({
        where: { id: departmentId },
      });

      if (!department) {
        throw new NotFoundException('Department not found');
      }

      if (!department.isActive) {
        throw new BadRequestException(
          'Cannot assign a department head to an inactive department',
        );
      }

      if (employee.departmentId !== departmentId) {
        throw new BadRequestException(
          'Employee must belong to the department before becoming its head',
        );
      }

      const existingHead = await tx.department.findFirst({
        where: {
          headEmployeeId: employeeId,
          NOT: { id: departmentId },
        },
      });

      if (existingHead) {
        throw new BadRequestException(
          'Employee is already the head of another department',
        );
      }

      return tx.department.update({
        where: { id: departmentId },
        data: { headEmployeeId: employeeId },
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
    });
  }

  async removeAsDepartmentHead(employeeId: number) {
    const department = await this.prisma.department.findFirst({
      where: { headEmployeeId: employeeId },
    });

    if (!department) {
      throw new NotFoundException(
        'This employee is not assigned as a department head',
      );
    }

    return this.prisma.department.update({
      where: { id: department.id },
      data: { headEmployeeId: null },
    });
  }
}

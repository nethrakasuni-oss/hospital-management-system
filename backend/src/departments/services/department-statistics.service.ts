
import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class DepartmentStatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // OVERALL DEPARTMENT STATISTICS
  // ==========================================

  async getOverallStatistics() {
    const [
      totalDepartments,
      activeDepartments,
      inactiveDepartments,
      totalDoctors,
      totalEmployees,
      totalWards,
      departments,
    ] = await this.prisma.$transaction([
      this.prisma.department.count(),

      this.prisma.department.count({
        where: { isActive: true },
      }),

      this.prisma.department.count({
        where: { isActive: false },
      }),

      this.prisma.doctor.count(),

      this.prisma.employee.count(),

      this.prisma.ward.count(),

      this.prisma.department.findMany({
        include: {
          _count: {
            select: {
              doctors: true,
              employees: true,
              wards: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      }),
    ]);

    return {
      summary: {
        totalDepartments,
        activeDepartments,
        inactiveDepartments,
        totalDoctors,
        totalEmployees,
        totalWards,
      },

      departmentBreakdown: departments.map(
        (department) => ({
          id: department.id,
          code: department.code,
          name: department.name,
          isActive: department.isActive,
          doctors: department._count.doctors,
          employees: department._count.employees,
          wards: department._count.wards,
        }),
      ),
    };
  }

  // ==========================================
  // INDIVIDUAL DEPARTMENT STATISTICS
  // ==========================================

  async getDepartmentStatistics(departmentId: number) {
    const department =
      await this.prisma.department.findUnique({
        where: {
          id: departmentId,
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
                  phone: true,
                },
              },
            },
          },

          doctors: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },

          employees: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },

          wards: true,

          _count: {
            select: {
              doctors: true,
              employees: true,
              wards: true,
            },
          },
        },
      });

    if (!department) {
      throw new NotFoundException(
        'Department not found',
      );
    }

    return {
      department: {
        id: department.id,
        code: department.code,
        name: department.name,
        description: department.description,
        isActive: department.isActive,
      },

      departmentHead: department.headEmployee
        ? {
            employeeId: department.headEmployee.id,
            employeeNo: department.headEmployee.employeeNo,
            designation: department.headEmployee.designation,
            firstName:
              department.headEmployee.user.firstName,
            lastName:
              department.headEmployee.user.lastName,
            email: department.headEmployee.user.email,
          }
        : null,

      statistics: {
        totalDoctors: department._count.doctors,
        totalEmployees: department._count.employees,
        totalWards: department._count.wards,
      },

      doctors: department.doctors.map((doctor) => ({
        id: doctor.id,
        registrationNo: doctor.registrationNo,
        specialization: doctor.specialization,
        active: doctor.active,
        firstName: doctor.user.firstName,
        lastName: doctor.user.lastName,
      })),

      employees: department.employees.map((employee) => ({
        id: employee.id,
        employeeNo: employee.employeeNo,
        designation: employee.designation,
        firstName: employee.user.firstName,
        lastName: employee.user.lastName,
      })),

      wards: department.wards,
    };
  }

  // ==========================================
  // DEPARTMENT STAFFING SUMMARY
  // ==========================================

  async getStaffingSummary() {
    const departments =
      await this.prisma.department.findMany({
        where: {
          isActive: true,
        },
        include: {
          headEmployee: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          _count: {
            select: {
              doctors: true,
              employees: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });

    return departments.map((department) => ({
      departmentId: department.id,
      departmentCode: department.code,
      departmentName: department.name,

      departmentHead: department.headEmployee
        ? `${department.headEmployee.user.firstName} ${department.headEmployee.user.lastName}`
        : null,

      totalDoctors: department._count.doctors,
      totalEmployees: department._count.employees,

      totalStaff:
        department._count.doctors +
        department._count.employees,
    }));
  }

  // ==========================================
  // DEPARTMENTS WITHOUT A HEAD
  // ==========================================

  async getDepartmentsWithoutHead() {
    return this.prisma.department.findMany({
      where: {
        isActive: true,
        headEmployeeId: null,
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        _count: {
          select: {
            doctors: true,
            employees: true,
            wards: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }
}

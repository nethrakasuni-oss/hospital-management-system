import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class EmployeeStatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [
      totalEmployees,
      employeesWithDepartment,
      employeesWithoutDepartment,
      totalAttendanceRecords,
      totalLeaveRecords,
      departments,
    ] = await this.prisma.$transaction([
      this.prisma.employee.count(),
      this.prisma.employee.count({
        where: { departmentId: { not: null } },
      }),
      this.prisma.employee.count({
        where: { departmentId: null },
      }),
      this.prisma.attendance.count(),
      this.prisma.leaveRecord.count(),
      this.prisma.department.findMany({
        include: {
          _count: {
            select: { employees: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      summary: {
        totalEmployees,
        employeesWithDepartment,
        employeesWithoutDepartment,
        totalAttendanceRecords,
        totalLeaveRecords,
      },
      departmentBreakdown: departments.map((department) => ({
        departmentId: department.id,
        departmentName: department.name,
        employeeCount: department._count.employees,
      })),
    };
  }

  async getEmployeeStatistics(employeeId: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        department: true,
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

    return {
      employeeId: employee.id,
      employeeNo: employee.employeeNo,
      designation: employee.designation,
      department: employee.department,
      totalAttendanceRecords: employee._count.attendanceRecords,
      totalLeaveRecords: employee._count.leaveRecords,
      joinedDate: employee.joinedDate,
    };
  }
}

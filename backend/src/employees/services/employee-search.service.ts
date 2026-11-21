import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface EmployeeSearchOptions {
  search?: string;
  departmentId?: number;
  designation?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class EmployeeSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(options: EmployeeSearchOptions) {
    const page = options.page ?? 1;
    const limit = options.limit ?? 10;

    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestException('Page must be a positive integer');
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }

    if (
      options.departmentId !== undefined &&
      (!Number.isInteger(options.departmentId) ||
        options.departmentId < 1)
    ) {
      throw new BadRequestException('Invalid department ID');
    }

    const where: Prisma.EmployeeWhereInput = {
      ...(options.departmentId !== undefined
        ? { departmentId: options.departmentId }
        : {}),
      ...(options.designation
        ? {
            designation: {
              contains: options.designation,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(options.search
        ? {
            OR: [
              {
                employeeNo: {
                  contains: options.search,
                  mode: 'insensitive',
                },
              },
              {
                designation: {
                  contains: options.search,
                  mode: 'insensitive',
                },
              },
              {
                user: {
                  is: {
                    OR: [
                      {
                        firstName: {
                          contains: options.search,
                          mode: 'insensitive',
                        },
                      },
                      {
                        lastName: {
                          contains: options.search,
                          mode: 'insensitive',
                        },
                      },
                      {
                        email: {
                          contains: options.search,
                          mode: 'insensitive',
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
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
          _count: {
            select: {
              attendanceRecords: true,
              leaveRecords: true,
            },
          },
        },
        orderBy: { id: 'desc' },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getByDepartment(departmentId: number) {
    return this.prisma.employee.findMany({
      where: { departmentId },
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
      orderBy: { employeeNo: 'asc' },
    });
  }
}

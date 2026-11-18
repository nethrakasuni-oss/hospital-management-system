
import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';

export interface DoctorSearchOptions {
  search?: string;
  specialization?: string;
  departmentId?: number;
  active?: boolean;
  page?: number;
  limit?: number;
}

@Injectable()
export class DoctorSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(options: DoctorSearchOptions) {
    const page = options.page ?? 1;
    const limit = options.limit ?? 10;

    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestException('Invalid page number');
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException(
        'Limit must be between 1 and 100',
      );
    }

    if (
      options.departmentId !== undefined &&
      (!Number.isInteger(options.departmentId) ||
        options.departmentId < 1)
    ) {
      throw new BadRequestException('Invalid department ID');
    }

    const skip = (page - 1) * limit;

    const where = {
      ...(options.active !== undefined
        ? { active: options.active }
        : {}),

      ...(options.specialization
        ? {
            specialization: {
              contains: options.specialization,
              mode: 'insensitive' as const,
            },
          }
        : {}),

      ...(options.departmentId !== undefined
        ? { departmentId: options.departmentId }
        : {}),

      ...(options.search
        ? {
            OR: [
              {
                registrationNo: {
                  contains: options.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                specialization: {
                  contains: options.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                qualification: {
                  contains: options.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                user: {
                  is: {
                    OR: [
                      {
                        firstName: {
                          contains: options.search,
                          mode: 'insensitive' as const,
                        },
                      },
                      {
                        lastName: {
                          contains: options.search,
                          mode: 'insensitive' as const,
                        },
                      },
                      {
                        email: {
                          contains: options.search,
                          mode: 'insensitive' as const,
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

    const [doctors, total] = await this.prisma.$transaction([
      this.prisma.doctor.findMany({
        where,
        skip,
        take: limit,
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
        orderBy: {
          createdAt: 'desc',
        },
      }),

      this.prisma.doctor.count({ where }),
    ]);

    return {
      data: doctors,
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

  async getSpecializations() {
    const results = await this.prisma.doctor.findMany({
      where: {
        active: true,
        specialization: { not: null },
      },
      distinct: ['specialization'],
      select: {
        specialization: true,
      },
      orderBy: {
        specialization: 'asc',
      },
    });

    return results
      .map((item) => item.specialization)
      .filter((value): value is string => value !== null);
  }

  async getDepartmentDoctors(departmentId: number) {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!department) {
      throw new BadRequestException('Department not found');
    }

    return this.prisma.doctor.findMany({
      where: {
        departmentId,
        active: true,
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
      orderBy: {
        user: {
          firstName: 'asc',
        },
      },
    });
  }
}

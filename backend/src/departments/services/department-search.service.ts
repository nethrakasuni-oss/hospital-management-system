
import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';

export interface DepartmentSearchOptions {
  search?: string;
  active?: boolean;
  headEmployeeId?: number;
  page?: number;
  limit?: number;
}

@Injectable()
export class DepartmentSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(options: DepartmentSearchOptions) {
    const page = options.page ?? 1;
    const limit = options.limit ?? 10;

    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestException('Invalid page number');
    }

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      throw new BadRequestException(
        'Limit must be between 1 and 100',
      );
    }

    if (
      options.headEmployeeId !== undefined &&
      (!Number.isInteger(options.headEmployeeId) ||
        options.headEmployeeId < 1)
    ) {
      throw new BadRequestException(
        'Invalid department head employee ID',
      );
    }

    const skip = (page - 1) * limit;

    const where = {
      ...(options.active !== undefined
        ? { isActive: options.active }
        : {}),

      ...(options.headEmployeeId !== undefined
        ? { headEmployeeId: options.headEmployeeId }
        : {}),

      ...(options.search
        ? {
            OR: [
              {
                name: {
                  contains: options.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                code: {
                  contains: options.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                description: {
                  contains: options.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [departments, total] =
      await this.prisma.$transaction([
        this.prisma.department.findMany({
          where,
          skip,
          take: limit,
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

        this.prisma.department.count({ where }),
      ]);

    return {
      data: departments,
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

  async getActiveDepartments() {
    return this.prisma.department.findMany({
      where: {
        isActive: true,
      },
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
    });
  }

  async getInactiveDepartments() {
    return this.prisma.department.findMany({
      where: {
        isActive: false,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findByCode(code: string) {
    const normalizedCode = code.trim().toUpperCase();

    if (!normalizedCode) {
      throw new BadRequestException(
        'Department code is required',
      );
    }

    const department =
      await this.prisma.department.findUnique({
        where: {
          code: normalizedCode,
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
      throw new BadRequestException(
        'Department not found for this code',
      );
    }

    return department;
  }
}

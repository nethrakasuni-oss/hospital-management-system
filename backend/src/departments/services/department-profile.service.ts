
import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateDepartmentDto } from '../dto/create-department.dto.js';
import { UpdateDepartmentDto } from '../dto/update-department.dto.js';

@Injectable()
export class DepartmentProfileService {
  constructor(private readonly prisma: PrismaService) {}

  private handleUniqueError(error: unknown): never {
    const dbError = error as { code?: string };

    if (dbError?.code === 'P2002') {
      throw new ConflictException(
        'Department name or code already exists',
      );
    }

    throw error;
  }

  async create(dto: CreateDepartmentDto) {
    try {
      const name = dto.name.trim();

      if (!name) {
        throw new BadRequestException(
          'Department name is required',
        );
      }

      const code = dto.code?.trim().toUpperCase();

      return await this.prisma.department.create({
        data: {
          name,
          code,
          description: dto.description?.trim(),
          isActive: dto.isActive ?? true,
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
      });
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.handleUniqueError(error);
    }
  }

  async findAll() {
    return this.prisma.department.findMany({
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

  async findOne(id: number) {
    const department = await this.prisma.department.findUnique({
      where: { id },
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
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        employees: {
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
      throw new NotFoundException('Department not found');
    }

    return department;
  }

  async update(id: number, dto: UpdateDepartmentDto) {
    await this.findOne(id);

    const data = {
      ...(dto.code !== undefined
        ? { code: dto.code.trim().toUpperCase() }
        : {}),
      ...(dto.name !== undefined
        ? { name: dto.name.trim() }
        : {}),
      ...(dto.description !== undefined
        ? { description: dto.description?.trim() || null }
        : {}),
      ...(dto.isActive !== undefined
        ? { isActive: dto.isActive }
        : {}),
    };

    if (dto.name !== undefined && !dto.name.trim()) {
      throw new BadRequestException(
        'Department name cannot be empty',
      );
    }

    try {
      return await this.prisma.department.update({
        where: { id },
        data,
        include: {
          _count: {
            select: {
              doctors: true,
              employees: true,
              wards: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleUniqueError(error);
    }
  }

  async deactivate(id: number) {
    await this.findOne(id);

    return this.prisma.department.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async reactivate(id: number) {
    await this.findOne(id);

    return this.prisma.department.update({
      where: { id },
      data: { isActive: true },
    });
  }
}

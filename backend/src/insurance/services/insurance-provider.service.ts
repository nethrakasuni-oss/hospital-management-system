
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateInsuranceProviderDto } from '../dto/create-insurance-provider.dto.js';
import { UpdateInsuranceProviderDto } from '../dto/update-insurance-provider.dto.js';

@Injectable()
export class InsuranceProviderService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateInsuranceProviderDto, userId: number) {
    try {
      const provider = await this.prisma.insuranceProvider.create({
        data: {
          name: dto.name.trim(),
          code: dto.code?.trim() || null,
          contactPerson: dto.contactPerson?.trim() || null,
          email: dto.email?.trim().toLowerCase() || null,
          phone: dto.phone?.trim() || null,
          address: dto.address?.trim() || null,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'CREATE',
          entity: 'InsuranceProvider',
          entityId: String(provider.id),
          userId,
          newData: {
            name: provider.name,
            code: provider.code,
          },
        },
      });

      return provider;
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException(
          'Insurance provider code already exists',
        );
      }
      throw error;
    }
  }

  findAll(includeInactive = false) {
    return this.prisma.insuranceProvider.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        _count: {
          select: {
            policies: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(id: number) {
    const provider = await this.prisma.insuranceProvider.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            policies: true,
          },
        },
      },
    });

    if (!provider) {
      throw new NotFoundException('Insurance provider not found');
    }

    return provider;
  }

  async update(
    id: number,
    dto: UpdateInsuranceProviderDto,
    userId: number,
  ) {
    const before = await this.findOne(id);

    try {
      const updated = await this.prisma.insuranceProvider.update({
        where: { id },
        data: {
          ...(dto.name !== undefined
            ? { name: dto.name.trim() }
            : {}),
          ...(dto.code !== undefined
            ? { code: dto.code?.trim() || null }
            : {}),
          ...(dto.contactPerson !== undefined
            ? { contactPerson: dto.contactPerson?.trim() || null }
            : {}),
          ...(dto.email !== undefined
            ? { email: dto.email?.trim().toLowerCase() || null }
            : {}),
          ...(dto.phone !== undefined
            ? { phone: dto.phone?.trim() || null }
            : {}),
          ...(dto.address !== undefined
            ? { address: dto.address?.trim() || null }
            : {}),
          ...(dto.isActive !== undefined
            ? { isActive: dto.isActive }
            : {}),
        },
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'UPDATE',
          entity: 'InsuranceProvider',
          entityId: String(id),
          userId,
          oldData: {
            name: before.name,
            code: before.code,
            isActive: before.isActive,
          },
          newData: {
            name: updated.name,
            code: updated.code,
            isActive: updated.isActive,
          },
        },
      });

      return updated;
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException(
          'Insurance provider code already exists',
        );
      }
      throw error;
    }
  }
}

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateOperationTheatreDto } from './dto/create-operation-theatre.dto.js';
import { UpdateOperationTheatreDto } from './dto/update-operation-theatre.dto.js';

@Injectable()
export class OperationTheatreService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOperationTheatreDto) {
    const exists = await this.prisma.operationTheatre.findUnique({ where: { theatreCode: dto.theatreCode } });
    if (exists) throw new ConflictException('Theatre code already exists');
    return this.prisma.operationTheatre.create({ data: { ...dto, status: (dto.status ?? 'AVAILABLE') as never } });
  }

  findAll(active?: boolean, status?: string) {
    return this.prisma.operationTheatre.findMany({
      where: { ...(active !== undefined ? { isActive: active } : {}), ...(status ? { status: status as never } : {}) },
      include: { surgeryBookings: { where: { status: { in: ['SCHEDULED', 'PREPARATION', 'IN_PROGRESS'] } }, orderBy: { plannedStartAt: 'asc' } } },
      orderBy: { theatreCode: 'asc' },
    });
  }

  async findOne(id: number) {
    const row = await this.prisma.operationTheatre.findUnique({ where: { id }, include: { surgeryBookings: { orderBy: { plannedStartAt: 'desc' }, take: 20 } } });
    if (!row) throw new NotFoundException('Operation theatre not found');
    return row;
  }

  
async update(id: number, dto: UpdateOperationTheatreDto) {
  await this.findOne(id);

  if (
    dto.status === 'MAINTENANCE' ||
    dto.status === 'UNAVAILABLE'
  ) {
    const active = await this.prisma.surgeryBooking.count({
      where: {
        theatreId: id,
        status: {
          in: ['SCHEDULED', 'PREPARATION', 'IN_PROGRESS'],
        },
        plannedEndAt: { gt: new Date() },
      },
    });

    if (active) {
      throw new ConflictException(
        'Theatre has active or upcoming surgery bookings; reschedule them before changing availability',
      );
    }
  }

  return this.prisma.operationTheatre.update({
    where: { id },
    data: {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.location !== undefined ? { location: dto.location } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.status !== undefined
        ? { status: dto.status as never }
        : {}),
    },
  });
}


  async deactivate(id: number) {
    await this.findOne(id);
    const active = await this.prisma.surgeryBooking.count({ where: { theatreId: id, status: { in: ['SCHEDULED', 'PREPARATION', 'IN_PROGRESS'] } } });
    if (active) throw new ConflictException('Cannot deactivate a theatre with active bookings');
    return this.prisma.operationTheatre.update({ where: { id }, data: { isActive: false } });
  }
}

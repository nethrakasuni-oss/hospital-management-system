import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateSupplierDto } from '../dto/create-supplier.dto.js';
import { UpdateSupplierDto } from '../dto/update-supplier.dto.js';
@Injectable()
export class SupplierService {
  constructor(private readonly prisma: PrismaService) {}
  async create(dto: CreateSupplierDto) {
    try { return await this.prisma.supplier.create({ data: {
      name: dto.name.trim(), code: dto.code?.trim() || null,
      contactPerson: dto.contactPerson?.trim() || null,
      email: dto.email?.trim().toLowerCase() || null,
      phone: dto.phone?.trim() || null, address: dto.address?.trim() || null,
    }}); } catch (e) {
      if ((e as {code?:string}).code === 'P2002') throw new ConflictException('Supplier code already exists');
      throw e;
    }
  }
  findAll(includeInactive = false) {
    return this.prisma.supplier.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' },
    });
  }
  async findOne(id: number) {
    const row = await this.prisma.supplier.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Supplier not found');
    return row;
  }
  async update(id: number, dto: UpdateSupplierDto) {
    await this.findOne(id);
    try { return await this.prisma.supplier.update({ where: { id }, data: {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.code !== undefined ? { code: dto.code?.trim() || null } : {}),
      ...(dto.contactPerson !== undefined ? { contactPerson: dto.contactPerson?.trim() || null } : {}),
      ...(dto.email !== undefined ? { email: dto.email?.trim().toLowerCase() || null } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
      ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    }}); } catch (e) {
      if ((e as {code?:string}).code === 'P2002') throw new ConflictException('Supplier code already exists');
      throw e;
    }
  }
}

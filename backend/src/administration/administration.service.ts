import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpsertSystemSettingDto } from './dto/system-setting.dto.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { CreatePermissionDto } from './dto/create-permission.dto.js';
import { AssignPermissionsDto } from './dto/assign-permissions.dto.js';
import { UpdateUserAdminDto } from './dto/update-user-admin.dto.js';
import { AdminQueryDto } from './dto/admin-query.dto.js';

@Injectable()
export class AdministrationService {
  constructor(private readonly prisma: PrismaService) {}

  private jsonValue(value: unknown): Prisma.InputJsonValue {
    try {
      const serialized = JSON.stringify(value);
      if (serialized === undefined) throw new Error('undefined');
      return JSON.parse(serialized) as Prisma.InputJsonValue;
    } catch {
      throw new BadRequestException('Setting value must be valid JSON');
    }
  }

  private async audit(
    userId: number,
    action: string,
    entity: string,
    entityId: string | number | null,
    oldData?: unknown,
    newData?: unknown,
    ipAddress?: string,
  ) {
    return this.prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId: entityId === null ? null : String(entityId),
        oldData: oldData === undefined ? Prisma.JsonNull : this.jsonValue(oldData),
        newData: newData === undefined ? Prisma.JsonNull : this.jsonValue(newData),
        ipAddress: ipAddress?.slice(0, 64) ?? null,
      },
    });
  }

  async getPublicSettings() {
    return this.prisma.systemSetting.findMany({
      where: { isPublic: true },
      orderBy: { key: 'asc' },
      select: { key: true, value: true, description: true, updatedAt: true },
    });
  }

  async listSettings(query: AdminQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where: Prisma.SystemSettingWhereInput = query.search
      ? { OR: [
          { key: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
        ] }
      : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.systemSetting.findMany({
        where, orderBy: { key: 'asc' }, skip: (page - 1) * limit, take: limit,
      }),
      this.prisma.systemSetting.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async upsertSetting(dto: UpsertSystemSettingDto, actorId: number, ip?: string) {
    const key = dto.key.trim();
    if (!/^[a-zA-Z][a-zA-Z0-9_.-]{1,119}$/.test(key)) {
      throw new BadRequestException('Setting key must be 2–120 characters and contain only letters, numbers, dot, underscore or hyphen');
    }
    const old = await this.prisma.systemSetting.findUnique({ where: { key } });
    const value = this.jsonValue(dto.value);
    const saved = await this.prisma.systemSetting.upsert({
      where: { key },
      create: {
        key, value,
        description: dto.description?.trim() ?? null,
        isPublic: dto.isPublic ?? false,
      },
      update: {
        value,
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(dto.isPublic !== undefined ? { isPublic: dto.isPublic } : {}),
      },
    });
    await this.audit(actorId, old ? 'UPDATE' : 'CREATE', 'SystemSetting', saved.id,
      old ? { key: old.key, value: old.value, description: old.description, isPublic: old.isPublic } : undefined,
      { key: saved.key, value: saved.value, description: saved.description, isPublic: saved.isPublic }, ip);
    return saved;
  }

  async deleteSetting(id: number, actorId: number, ip?: string) {
    const old = await this.prisma.systemSetting.findUnique({ where: { id } });
    if (!old) throw new NotFoundException('System setting not found');
    await this.prisma.systemSetting.delete({ where: { id } });
    await this.audit(actorId, 'DELETE', 'SystemSetting', id,
      { key: old.key, value: old.value, isPublic: old.isPublic }, undefined, ip);
    return { message: 'System setting deleted' };
  }

  async hospitalProfile() {
    const keys = [
      'hospital.name', 'hospital.legalName', 'hospital.registrationNumber',
      'hospital.address', 'hospital.phone', 'hospital.email',
      'hospital.website', 'hospital.logoUrl', 'hospital.timezone',
      'hospital.currency', 'hospital.dateFormat',
    ];
    const rows = await this.prisma.systemSetting.findMany({ where: { key: { in: keys } } });
    return Object.fromEntries(rows.map(row => [row.key.replace('hospital.', ''), row.value]));
  }

  async updateHospitalProfile(
    values: Record<string, unknown>, actorId: number, ip?: string,
  ) {
    const allowed = new Set([
      'name', 'legalName', 'registrationNumber', 'address', 'phone',
      'email', 'website', 'logoUrl', 'timezone', 'currency', 'dateFormat',
    ]);
    const entries = Object.entries(values);
    if (!entries.length) throw new BadRequestException('Provide at least one hospital profile field');
    const unknown = entries.map(([key]) => key).filter(key => !allowed.has(key));
    if (unknown.length) throw new BadRequestException(`Unsupported hospital profile fields: ${unknown.join(', ')}`);

    const results = [];
    for (const [field, value] of entries) {
      if (typeof value !== 'string' || value.trim().length === 0) {
        throw new BadRequestException(`${field} must be a non-empty string`);
      }
      results.push(await this.upsertSetting({
        key: `hospital.${field}`,
        value: value.trim(),
        description: `Hospital profile: ${field}`,
        isPublic: ['name', 'address', 'phone', 'email', 'website', 'logoUrl'].includes(field),
      }, actorId, ip));
    }
    return this.hospitalProfile();
  }

  async listRoles() {
    return this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { users: true, rolePermissions: true } },
        rolePermissions: { include: { permission: true } },
      },
    });
  }

  async createRole(dto: CreateRoleDto, actorId: number, ip?: string) {
    const name = dto.name.trim().toUpperCase().replace(/\s+/g, '_');
    try {
      const role = await this.prisma.role.create({
        data: { name, description: dto.description?.trim() || null },
      });
      await this.audit(actorId, 'CREATE', 'Role', role.id, undefined, role, ip);
      return role;
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException('Role name already exists');
      }
      throw error;
    }
  }

  async updateRole(id: number, dto: Partial<CreateRoleDto>, actorId: number, ip?: string) {
    const old = await this.prisma.role.findUnique({ where: { id } });
    if (!old) throw new NotFoundException('Role not found');
    const role = await this.prisma.role.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim().toUpperCase().replace(/\s+/g, '_') } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
      },
    });
    await this.audit(actorId, 'UPDATE', 'Role', id, old, role, ip);
    return role;
  }

  async deleteRole(id: number, actorId: number, ip?: string) {
    const role = await this.prisma.role.findUnique({
      where: { id }, include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (role._count.users > 0) throw new BadRequestException('Cannot delete a role assigned to users');
    if (['ADMIN', 'SUPER_ADMIN'].includes(role.name)) {
      throw new BadRequestException('Built-in administrator roles cannot be deleted');
    }
    await this.prisma.role.delete({ where: { id } });
    await this.audit(actorId, 'DELETE', 'Role', id, role, undefined, ip);
    return { message: 'Role deleted' };
  }

  async listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { name: 'asc' } });
  }

  async createPermission(dto: CreatePermissionDto, actorId: number, ip?: string) {
    const name = dto.name.trim().toUpperCase().replace(/\s+/g, '.');
    try {
      const permission = await this.prisma.permission.create({
        data: { name, description: dto.description?.trim() || null },
      });
      await this.audit(actorId, 'CREATE', 'Permission', permission.id, undefined, permission, ip);
      return permission;
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException('Permission name already exists');
      }
      throw error;
    }
  }

  async assignPermissions(roleId: number, dto: AssignPermissionsDto, actorId: number, ip?: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId }, include: { rolePermissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    const ids = [...new Set(dto.permissionIds)];
    const found = await this.prisma.permission.findMany({ where: { id: { in: ids } }, select: { id: true } });
    if (found.length !== ids.length) throw new BadRequestException('One or more permission IDs do not exist');
    const before = role.rolePermissions.map(x => x.permissionId);

    await this.prisma.$transaction(async tx => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (ids.length) {
        await tx.rolePermission.createMany({
          data: ids.map(permissionId => ({ roleId, permissionId })),
          skipDuplicates: true,
        });
      }
    });
    const after = await this.prisma.rolePermission.findMany({
      where: { roleId }, include: { permission: true },
    });
    await this.audit(actorId, 'REPLACE_PERMISSIONS', 'Role', roleId, before, ids, ip);
    return { roleId, permissions: after.map(x => x.permission) };
  }

  async listUsers(query: AdminQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = search ? {
      OR: [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ],
    } : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where, select: {
          id: true, email: true, firstName: true, lastName: true,
          phone: true, status: true, roleId: true, role: { select: { id: true, name: true } },
          createdAt: true, updatedAt: true,
        },
        orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async updateUser(
    id: number, dto: UpdateUserAdminDto, actorId: number, ip?: string,
  ) {
    if (id === actorId && dto.status && dto.status !== 'ACTIVE') {
      throw new BadRequestException('You cannot deactivate or suspend your own account');
    }
    const old = await this.prisma.user.findUnique({
      where: { id }, select: { id: true, status: true, roleId: true },
    });
    if (!old) throw new NotFoundException('User not found');
    if (dto.roleId !== undefined) {
      const role = await this.prisma.role.findUnique({ where: { id: dto.roleId }, select: { id: true } });
      if (!role) throw new NotFoundException('Role not found');
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.roleId !== undefined ? { roleId: dto.roleId } : {}),
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        phone: true, status: true, roleId: true, role: { select: { id: true, name: true } },
      },
    });
    await this.audit(actorId, 'UPDATE', 'User', id, old, updated, ip);
    return updated;
  }

  async listAuditLogs(query: AdminQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const search = query.search?.trim();
    const where: Prisma.AuditLogWhereInput = search ? {
      OR: [
        { action: { contains: search, mode: 'insensitive' } },
        { entity: { contains: search, mode: 'insensitive' } },
        { entityId: { contains: search, mode: 'insensitive' } },
      ],
    } : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where, include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async dashboardSummary() {
    const [users, activeUsers, roles, permissions, settings, auditEvents] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.role.count(),
      this.prisma.permission.count(),
      this.prisma.systemSetting.count(),
      this.prisma.auditLog.count(),
    ]);
    return { users, activeUsers, inactiveOrSuspendedUsers: users - activeUsers, roles, permissions, settings, auditEvents };
  }
}

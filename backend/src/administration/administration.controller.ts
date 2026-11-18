import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put,
  Query, Req, UseGuards, UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles/roles.guard.js';
import { Roles } from '../auth/roles/roles.decorator.js';
import { AdministrationService } from './administration.service.js';
import { UpsertSystemSettingDto } from './dto/system-setting.dto.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { CreatePermissionDto } from './dto/create-permission.dto.js';
import { AssignPermissionsDto } from './dto/assign-permissions.dto.js';
import { UpdateUserAdminDto } from './dto/update-user-admin.dto.js';
import { AdminQueryDto } from './dto/admin-query.dto.js';


import { CreateStaffDto } from './dto/create-staff.dto.js';
import { StaffRegistrationService } from './staff-registration.service.js';


@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdministrationController {
  constructor(
  private readonly service: AdministrationService,
  private readonly staffRegistration: StaffRegistrationService,
) {}

  private actor(req: any) {
    const id = Number(req.user?.userId ?? req.user?.id);
    if (!Number.isInteger(id) || id < 1) throw new UnauthorizedException('Authenticated user ID is missing from JWT payload');
    return id;
  }
  private ip(req: any): string | undefined {
    return req.ip ?? req.headers?.['x-forwarded-for']?.toString().split(',')[0]?.trim();
  }

  @Get('dashboard')
  dashboard() { return this.service.dashboardSummary(); }

  @Get('settings')
  listSettings(@Query() query: AdminQueryDto) { return this.service.listSettings(query); }

  @Post('settings')
  upsertSetting(@Body() dto: UpsertSystemSettingDto, @Req() req: any) {
    return this.service.upsertSetting(dto, this.actor(req), this.ip(req));
  }

  @Delete('settings/:id')
  deleteSetting(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.deleteSetting(id, this.actor(req), this.ip(req));
  }

  @Get('hospital-profile')
  hospitalProfile() { return this.service.hospitalProfile(); }

  @Patch('hospital-profile')
  updateHospitalProfile(@Body() body: Record<string, unknown>, @Req() req: any) {
    return this.service.updateHospitalProfile(body, this.actor(req), this.ip(req));
  }

  @Get('roles')
  roles() { return this.service.listRoles(); }

  @Post('roles')
  createRole(@Body() dto: CreateRoleDto, @Req() req: any) {
    return this.service.createRole(dto, this.actor(req), this.ip(req));
  }

  @Patch('roles/:id')
  updateRole(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreateRoleDto>, @Req() req: any) {
    return this.service.updateRole(id, dto, this.actor(req), this.ip(req));
  }

  @Delete('roles/:id')
  deleteRole(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.deleteRole(id, this.actor(req), this.ip(req));
  }

  @Get('permissions')
  permissions() { return this.service.listPermissions(); }

  @Post('permissions')
  createPermission(@Body() dto: CreatePermissionDto, @Req() req: any) {
    return this.service.createPermission(dto, this.actor(req), this.ip(req));
  }

  @Put('roles/:id/permissions')
  assignPermissions(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignPermissionsDto, @Req() req: any) {
    return this.service.assignPermissions(id, dto, this.actor(req), this.ip(req));
  }

  @Get('users')
  users(@Query() query: AdminQueryDto) { return this.service.listUsers(query); }
  

  @Patch('users/:id')
  updateUser(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserAdminDto, @Req() req: any) {
    return this.service.updateUser(id, dto, this.actor(req), this.ip(req));
  }

@Post('staff')
createStaff(@Body() dto: CreateStaffDto, @Req() req: any) {
  return this.staffRegistration.create(
    dto,
    this.actor(req),
    this.ip(req),
  );
}


  @Get('audit-logs')
  auditLogs(@Query() query: AdminQueryDto) { return this.service.listAuditLogs(query); }
}

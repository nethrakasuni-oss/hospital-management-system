import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { EmergencyService } from './emergency.service.js';
import { CreateEmergencyVisitDto } from './dto/create-emergency-visit.dto.js';
import { UpdateEmergencyVisitDto } from './dto/update-emergency-visit.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles/roles.guard.js';
import { Roles } from '../auth/roles/roles.decorator.js';

@Controller('emergency')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmergencyController {
  constructor(private readonly service: EmergencyService) {}

  @Post('visits')
  @Roles('ADMIN', 'DOCTOR', 'NURSE', 'HR_MANAGER')
  create(@Body() dto: CreateEmergencyVisitDto, @Req() req: any) {
    return this.service.create(dto, req.user.userId);
  }

  @Get('visits')
  @Roles('ADMIN', 'DOCTOR', 'NURSE', 'HR_MANAGER')
  findAll(@Query('status') status?: string, @Query('triageLevel') triageLevel?: string,
    @Query('patientId') patientId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.findAll({
      ...(status ? { status } : {}),
      ...(triageLevel ? { triageLevel } : {}),
      ...(patientId ? { patientId: Number(patientId) } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    });
  }

  @Get('visits/:id')
  @Roles('ADMIN', 'DOCTOR', 'NURSE', 'HR_MANAGER')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Patch('visits/:id')
  @Roles('ADMIN', 'DOCTOR', 'NURSE')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEmergencyVisitDto) { return this.service.update(id, dto); }

  @Patch('visits/:id/status')
  @Roles('ADMIN', 'DOCTOR', 'NURSE')
  setStatus(@Param('id', ParseIntPipe) id: number, @Body() body: { status: string; disposition?: string }) {
    return this.service.setStatus(id, body.status, body.disposition);
  }
}

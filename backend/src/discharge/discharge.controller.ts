import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { DischargeService } from './discharge.service.js';
import { CreateDischargeSummaryDto } from './dto/create-discharge-summary.dto.js';
import { UpdateDischargeSummaryDto } from './dto/update-discharge-summary.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles/roles.guard.js';
import { Roles } from '../auth/roles/roles.decorator.js';

@Controller('discharges')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DischargeController {
  constructor(private readonly service: DischargeService) {}
  @Post() @Roles('ADMIN', 'DOCTOR') create(@Body() dto: CreateDischargeSummaryDto, @Req() req: any) { return this.service.create(dto, req.user.userId); }
  @Get() @Roles('ADMIN', 'DOCTOR', 'NURSE', 'HR_MANAGER') findAll(@Query('patientId') patientId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.findAll(patientId ? Number(patientId) : undefined, from, to);
  }
  @Get('admission/:admissionId') @Roles('ADMIN', 'DOCTOR', 'NURSE', 'HR_MANAGER') byAdmission(@Param('admissionId', ParseIntPipe) admissionId: number) { return this.service.byAdmission(admissionId); }
  @Get(':id') @Roles('ADMIN', 'DOCTOR', 'NURSE', 'HR_MANAGER') findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }
  @Patch(':id') @Roles('ADMIN', 'DOCTOR') update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDischargeSummaryDto) { return this.service.update(id, dto); }
}

import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SurgeryService } from './surgery.service.js';
import { CreateSurgeryBookingDto } from './dto/create-surgery-booking.dto.js';
import { UpdateSurgeryBookingDto } from './dto/update-surgery-booking.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles/roles.guard.js';
import { Roles } from '../auth/roles/roles.decorator.js';

@Controller('surgeries')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SurgeryController {
  constructor(private readonly service: SurgeryService) {}
  @Post() @Roles('ADMIN', 'DOCTOR') create(@Body() dto: CreateSurgeryBookingDto) { return this.service.create(dto); }
  @Get() @Roles('ADMIN', 'DOCTOR', 'NURSE', 'HR_MANAGER') findAll(@Query('patientId') patientId?: string, @Query('doctorId') doctorId?: string,
    @Query('theatreId') theatreId?: string, @Query('status') status?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.findAll({ ...(patientId ? { patientId: Number(patientId) } : {}), ...(doctorId ? { doctorId: Number(doctorId) } : {}),
      ...(theatreId ? { theatreId: Number(theatreId) } : {}), ...(status ? { status } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) });
  }
  @Get(':id') @Roles('ADMIN', 'DOCTOR', 'NURSE', 'HR_MANAGER') findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }
  @Patch(':id') @Roles('ADMIN', 'DOCTOR') update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSurgeryBookingDto) { return this.service.update(id, dto); }
  @Patch(':id/status') @Roles('ADMIN', 'DOCTOR', 'NURSE') transition(@Param('id', ParseIntPipe) id: number, @Body() body: { status: string; notes?: string; reason?: string }) {
    return this.service.transition(id, body.status, body.notes, body.reason);
  }
}

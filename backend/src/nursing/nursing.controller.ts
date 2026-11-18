import { Body, Controller, Get, Param, ParseBoolPipe, ParseIntPipe, Patch, Post, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { NursingService } from './nursing.service.js';
import { CreateNursingAssignmentDto } from './dto/create-nursing-assignment.dto.js';
import { UpdateNursingAssignmentDto } from './dto/update-nursing-assignment.dto.js';
import { CreateNursingNoteDto } from './dto/create-nursing-note.dto.js';
import { UpdateNursingNoteDto } from './dto/update-nursing-note.dto.js';
import { CreateNursingObservationDto } from './dto/create-nursing-observation.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles/roles.guard.js';
import { Roles } from '../auth/roles/roles.decorator.js';

@Controller('nursing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NursingController {
  constructor(private readonly nursing: NursingService, private readonly prisma: PrismaService) {}

  private async employeeIdForUser(userId: number): Promise<number> {
    const employee = await this.prisma.employee.findUnique({ where: { userId }, select: { id: true } });
    if (!employee) throw new BadRequestException('The authenticated user is not linked to an employee record');
    return employee.id;
  }

  @Post('assignments')
  @Roles('ADMIN', 'HR_MANAGER', 'NURSE')
  async createAssignment(@Body() dto: CreateNursingAssignmentDto, @Req() req: any) {
    return this.nursing.createAssignment(await this.employeeIdForUser(req.user.userId), dto);
  }

  @Get('assignments')
  @Roles('ADMIN', 'HR_MANAGER', 'NURSE', 'DOCTOR')
  findAssignments(
    @Query('patientId') patientId?: string,
    @Query('employeeId') employeeId?: string,
    @Query('admissionId') admissionId?: string,
    @Query('active') active?: string,
  ) {
    if (active !== undefined && active !== 'true' && active !== 'false') throw new BadRequestException('active must be true or false');
    return this.nursing.findAssignments({
      ...(patientId ? { patientId: Number(patientId) } : {}),
      ...(employeeId ? { employeeId: Number(employeeId) } : {}),
      ...(admissionId ? { admissionId: Number(admissionId) } : {}),
      ...(active !== undefined ? { active: active === 'true' } : {}),
    });
  }

  @Get('assignments/:id')
  @Roles('ADMIN', 'HR_MANAGER', 'NURSE', 'DOCTOR')
  findAssignment(@Param('id', ParseIntPipe) id: number) { return this.nursing.findAssignment(id); }

  @Patch('assignments/:id')
  @Roles('ADMIN', 'HR_MANAGER', 'NURSE')
  updateAssignment(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNursingAssignmentDto) {
    return this.nursing.updateAssignment(id, dto);
  }

  @Patch('assignments/:id/end')
  @Roles('ADMIN', 'HR_MANAGER', 'NURSE')
  endAssignment(@Param('id', ParseIntPipe) id: number) { return this.nursing.endAssignment(id); }

  @Post('notes')
  @Roles('ADMIN', 'HR_MANAGER', 'NURSE', 'DOCTOR')
  async createNote(@Body() dto: CreateNursingNoteDto, @Req() req: any) {
    const employee = await this.prisma.employee.findUnique({ where: { userId: req.user.userId }, select: { id: true } });
    return this.nursing.createNote(req.user.userId, employee?.id ?? null, dto);
  }

  @Get('patients/:patientId/notes')
  @Roles('ADMIN', 'HR_MANAGER', 'NURSE', 'DOCTOR')
  findPatientNotes(@Param('patientId', ParseIntPipe) patientId: number) { return this.nursing.findPatientNotes(patientId); }

  @Get('notes/:id')
  @Roles('ADMIN', 'HR_MANAGER', 'NURSE', 'DOCTOR')
  findNote(@Param('id', ParseIntPipe) id: number) { return this.nursing.findNote(id); }

  @Patch('notes/:id')
  @Roles('ADMIN', 'HR_MANAGER', 'NURSE')
  updateNote(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNursingNoteDto) { return this.nursing.updateNote(id, dto); }

  @Post('observations')
  @Roles('ADMIN', 'HR_MANAGER', 'NURSE')
  async createObservation(@Body() dto: CreateNursingObservationDto, @Req() req: any) {
    const employee = await this.prisma.employee.findUnique({ where: { userId: req.user.userId }, select: { id: true } });
    return this.nursing.createObservation(employee?.id ?? null, dto);
  }

  @Get('patients/:patientId/observations')
  @Roles('ADMIN', 'HR_MANAGER', 'NURSE', 'DOCTOR')
  findPatientObservations(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) { return this.nursing.findPatientObservations(patientId, from, to); }

  @Get('observations/:id')
  @Roles('ADMIN', 'HR_MANAGER', 'NURSE', 'DOCTOR')
  findObservation(@Param('id', ParseIntPipe) id: number) { return this.nursing.findObservation(id); }
}

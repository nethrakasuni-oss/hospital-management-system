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
import { Permissions } from '../auth/permissions/permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions/permissions.guard.js';
import { NursingCareWorkflowService } from './services/nursing-care-workflow.service.js';
import { CreateMedicationAdministrationDto } from './dto/create-medication-administration.dto.js';
import { CreateShiftHandoverDto } from './dto/create-shift-handover.dto.js';
import { CreateNursingDischargeClearanceDto } from './dto/create-nursing-discharge-clearance.dto.js';
import { ForbiddenException } from '@nestjs/common';

@Controller('nursing')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class NursingController {
  constructor(
    private readonly nursing: NursingService,
    private readonly prisma: PrismaService,
    private readonly careWorkflow: NursingCareWorkflowService,
  ) {}

  private async employeeIdForUser(userId: number): Promise<number> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      include: { user: { include: { role: true } } },
    });
    if (!employee) throw new BadRequestException('The authenticated user is not linked to an employee record');
    if (!employee.isActive) throw new ForbiddenException('Nurse employee record is inactive');
    if (employee.user.role.name !== 'NURSE') throw new ForbiddenException('The authenticated employee is not linked to the NURSE role');
    return employee.id;
  }

  private async assertNursePatientAccess(req: any, patientId: number) {
    if (req.user.role !== 'NURSE') return;
    const employeeId = await this.employeeIdForUser(req.user.userId);
    const assignment = await this.prisma.nursingAssignment.findFirst({
      where: { patientId, employeeId, active: true },
      select: { id: true },
    });
    if (!assignment) throw new ForbiddenException(`You can only access patients assigned to you (userId ${req.user.userId}, employeeId ${employeeId}, patientId ${patientId})`);
  }

  @Post('assignments')
  @Roles('ADMIN', 'HR_MANAGER')
  @Permissions('PATIENT_UPDATE')
  async createAssignment(@Body() dto: CreateNursingAssignmentDto, @Req() req: any) {
    return this.nursing.createAssignment(dto.employeeId, dto);
  }

  @Get('nurses')
  @Roles('ADMIN', 'HR_MANAGER')
  @Permissions('PATIENT_VIEW')
  findNurses() {
    return this.prisma.employee.findMany({
      where: { isActive: true, user: { role: { name: 'NURSE' } } },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } }, department: true },
      orderBy: { employeeNo: 'asc' },
    });
  }

  @Get('assignments')
  @Roles('ADMIN', 'HR_MANAGER', 'NURSE', 'DOCTOR')
  @Permissions('PATIENT_VIEW')
  async findAssignments(
    @Query('patientId') patientId?: string,
    @Query('employeeId') employeeId?: string,
    @Query('admissionId') admissionId?: string,
    @Query('active') active?: string,
    @Req() req?: any,
  ) {
    if (active !== undefined && active !== 'true' && active !== 'false') throw new BadRequestException('active must be true or false');
    const parsedPatientId = patientId === undefined ? undefined : Number(patientId);
    const parsedEmployeeId = employeeId === undefined ? undefined : Number(employeeId);
    const parsedAdmissionId = admissionId === undefined ? undefined : Number(admissionId);
    for (const [value, label] of [[parsedPatientId,'patientId'],[parsedEmployeeId,'employeeId'],[parsedAdmissionId,'admissionId']] as [number | undefined,string][]) {
      if (value !== undefined && (!Number.isInteger(value) || value < 1)) throw new BadRequestException(`${label} must be a positive integer`);
    }
    const filters: { patientId?: number; employeeId?: number; admissionId?: number; active?: boolean } = {
      ...(parsedPatientId !== undefined ? { patientId: parsedPatientId } : {}),
      ...(parsedEmployeeId !== undefined ? { employeeId: parsedEmployeeId } : {}),
      ...(parsedAdmissionId !== undefined ? { admissionId: parsedAdmissionId } : {}),
      ...(active !== undefined ? { active: active === 'true' } : {}),
    };
    if (req?.user?.role === 'NURSE') {
      filters.employeeId = await this.employeeIdForUser(req.user.userId);
    }
    return this.nursing.findAssignments(filters);
  }

  @Get('assignments/:id')
  @Roles('ADMIN', 'HR_MANAGER', 'NURSE', 'DOCTOR')
  @Permissions('PATIENT_VIEW')
  async findAssignment(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const item = await this.nursing.findAssignment(id);
    if (req.user.role === 'NURSE') {
      const employeeId = await this.employeeIdForUser(req.user.userId);
      if (item.employeeId !== employeeId) throw new ForbiddenException('You can only view your own assignments');
    }
    return item;
  }

  @Patch('assignments/:id')
  @Roles('ADMIN', 'HR_MANAGER')
  @Permissions('PATIENT_UPDATE')
  updateAssignment(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNursingAssignmentDto) {
    return this.nursing.updateAssignment(id, dto);
  }

  @Patch('assignments/:id/end')
  @Roles('ADMIN', 'HR_MANAGER')
  @Permissions('PATIENT_UPDATE')
  endAssignment(@Param('id', ParseIntPipe) id: number) { return this.nursing.endAssignment(id); }

  @Post('notes')
  @Roles('ADMIN', 'HR_MANAGER', 'NURSE', 'DOCTOR')
  @Permissions('MEDICAL_RECORD_CREATE')
  async createNote(@Body() dto: CreateNursingNoteDto, @Req() req: any) {
    if (req.user.role === 'NURSE') await this.assertNursePatientAccess(req, dto.patientId);
    const employee = await this.prisma.employee.findUnique({ where: { userId: req.user.userId }, select: { id: true } });
    return this.nursing.createNote(req.user.userId, employee?.id ?? null, dto);
  }

  @Get('patients/:patientId/notes')
  @Roles('ADMIN', 'HR_MANAGER', 'NURSE', 'DOCTOR')
  @Permissions('MEDICAL_RECORD_VIEW')
  async findPatientNotes(@Param('patientId', ParseIntPipe) patientId: number, @Req() req: any) {
    await this.assertNursePatientAccess(req, patientId);
    return this.nursing.findPatientNotes(patientId);
  }

  @Get('notes/:id')
  @Roles('ADMIN', 'HR_MANAGER', 'NURSE', 'DOCTOR')
  @Permissions('MEDICAL_RECORD_VIEW')
  async findNote(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const note = await this.nursing.findNote(id);
    await this.assertNursePatientAccess(req, note.patientId);
    return note;
  }

  @Patch('notes/:id')
  @Roles('ADMIN', 'HR_MANAGER', 'NURSE')
  async updateNote(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNursingNoteDto, @Req() req: any) {
    const note = await this.nursing.findNote(id);
    await this.assertNursePatientAccess(req, note.patientId);
    return this.nursing.updateNote(id, dto);
  }

  @Post('observations')
  @Roles('ADMIN', 'HR_MANAGER', 'NURSE')
  @Permissions('MEDICAL_RECORD_CREATE')
  async createObservation(@Body() dto: CreateNursingObservationDto, @Req() req: any) {
    await this.assertNursePatientAccess(req, dto.patientId);
    const employee = await this.prisma.employee.findUnique({ where: { userId: req.user.userId }, select: { id: true } });
    return this.nursing.createObservation(employee?.id ?? null, dto);
  }

  @Get('patients/:patientId/observations')
  @Roles('ADMIN', 'HR_MANAGER', 'NURSE', 'DOCTOR')
  @Permissions('MEDICAL_RECORD_VIEW')
  async findPatientObservations(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Req() req?: any,
  ) {
    await this.assertNursePatientAccess(req, patientId);
    return this.nursing.findPatientObservations(patientId, from, to);
  }

  @Get('observations/:id')
  @Roles('ADMIN', 'HR_MANAGER', 'NURSE', 'DOCTOR')
  @Permissions('MEDICAL_RECORD_VIEW')
  async findObservation(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const observation = await this.nursing.findObservation(id);
    await this.assertNursePatientAccess(req, observation.patientId);
    return observation;
  }

  @Post('medication-administrations')
  @Roles('ADMIN', 'NURSE')
  @Permissions('MEDICAL_RECORD_CREATE')
  createMedicationAdministration(@Body() dto: CreateMedicationAdministrationDto, @Req() req: any) {
    return this.careWorkflow.createMedication(dto, req.user.userId, req.user.role);
  }

  @Get('patients/:patientId/medication-administrations')
  @Roles('ADMIN', 'NURSE', 'DOCTOR')
  @Permissions('MEDICAL_RECORD_VIEW')
  medicationAdministrationHistory(@Param('patientId', ParseIntPipe) patientId: number, @Req() req: any) {
    return this.careWorkflow.medicationHistory(patientId, req.user.userId, req.user.role);
  }

  @Post('handovers')
  @Roles('ADMIN', 'NURSE')
  @Permissions('MEDICAL_RECORD_CREATE')
  createHandover(@Body() dto: CreateShiftHandoverDto, @Req() req: any) {
    return this.careWorkflow.createHandover(dto, req.user.userId, req.user.role);
  }

  @Get('patients/:patientId/handovers')
  @Roles('ADMIN', 'NURSE', 'DOCTOR')
  @Permissions('MEDICAL_RECORD_VIEW')
  handoverHistory(@Param('patientId', ParseIntPipe) patientId: number, @Req() req: any) {
    return this.careWorkflow.handoverHistory(patientId, req.user.userId, req.user.role);
  }

  @Post('discharge-clearance')
  @Roles('ADMIN', 'NURSE')
  @Permissions('MEDICAL_RECORD_CREATE')
  createDischargeClearance(@Body() dto: CreateNursingDischargeClearanceDto, @Req() req: any) {
    return this.careWorkflow.createDischargeClearance(dto, req.user.userId, req.user.role);
  }
}

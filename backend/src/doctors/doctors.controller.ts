
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  Req,
  DefaultValuePipe,
  BadRequestException,
} from '@nestjs/common';

import { DoctorsService } from './doctors.service.js';

import { CreateDoctorDto } from './dto/create-doctor.dto.js';
import { UpdateDoctorDto } from './dto/update-doctor.dto.js';
import { CreateDoctorScheduleDto } from './dto/create-doctor-schedule.dto.js';
import { CreateDoctorAvailabilityDto } from './dto/create-doctor-availability.dto.js';
import { CreateDoctorLeaveDto } from './dto/create-doctor-leave.dto.js';
import { ReviewDoctorLeaveDto } from './dto/review-doctor-leave.dto.js';

import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles/roles.guard.js';
import { Roles } from '../auth/roles/roles.decorator.js';

interface AuthenticatedRequest {
  user: {
    userId: number;
    email: string;
    role: string;
    permissions: string[];
  };
}

@Controller('doctors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DoctorsController {
  constructor(
    private readonly doctorsService: DoctorsService,
  ) {}

  // ==========================================
  // OWNERSHIP HELPER
  // ==========================================

  private async verifyDoctorAccess(
    doctorId: number,
    req: AuthenticatedRequest,
  ) {
    if (req.user.role === 'DOCTOR') {
      await this.doctorsService.assertDoctorOwnership(
        doctorId,
        req.user.userId,
      );
    }
  }

  private async verifyLeaveAccess(
    leaveId: number,
    req: AuthenticatedRequest,
  ) {
    if (req.user.role === 'DOCTOR') {
      await this.doctorsService.assertLeaveOwnership(
        leaveId,
        req.user.userId,
      );
    }
  }

  // ==========================================
  // DOCTOR PROFILES
  // ==========================================

  @Post()
  @Roles('ADMIN', 'HR_MANAGER')
  create(@Body() dto: CreateDoctorDto) {
    return this.doctorsService.create(dto);
  }

  @Get()
  @Roles('ADMIN', 'HR_MANAGER', 'RECEPTIONIST', 'DOCTOR')
  findAll() {
    return this.doctorsService.findAll();
  }

  // ==========================================
  // DOCTOR SEARCH
  // ==========================================

  @Get('search')
  @Roles('ADMIN', 'HR_MANAGER', 'RECEPTIONIST', 'DOCTOR')
  search(
    @Query('search') search?: string,
    @Query('specialization') specialization?: string,
    @Query('departmentId') departmentId?: string,
    @Query('active') active?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page?: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe)
    limit?: number,
  ) {
    if (
      active !== undefined &&
      active !== 'true' &&
      active !== 'false'
    ) {
      throw new BadRequestException(
        'active must be true or false',
      );
    }

    let parsedDepartmentId: number | undefined;

    if (departmentId !== undefined) {
      parsedDepartmentId = Number(departmentId);

      if (
        !Number.isInteger(parsedDepartmentId) ||
        parsedDepartmentId < 1
      ) {
        throw new BadRequestException(
          'Invalid department ID',
        );
      }
    }

    return this.doctorsService.search({
      search,
      specialization,
      departmentId: parsedDepartmentId,
      active:
        active !== undefined ? active === 'true' : undefined,
      page,
      limit,
    });
  }

  @Get('specializations')
  @Roles('ADMIN', 'HR_MANAGER', 'RECEPTIONIST', 'DOCTOR')
  getSpecializations() {
    return this.doctorsService.getSpecializations();
  }

  @Get('department/:departmentId')
  @Roles('ADMIN', 'HR_MANAGER', 'RECEPTIONIST', 'DOCTOR')
  getDepartmentDoctors(
    @Param('departmentId', ParseIntPipe)
    departmentId: number,
  ) {
    return this.doctorsService.getDepartmentDoctors(
      departmentId,
    );
  }

  @Get(':id')
  @Roles('ADMIN', 'HR_MANAGER', 'RECEPTIONIST', 'DOCTOR')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.verifyDoctorAccess(id, req);

    return this.doctorsService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'HR_MANAGER')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDoctorDto,
  ) {
    return this.doctorsService.update(id, dto);
  }

  @Patch(':id/deactivate')
  @Roles('ADMIN', 'HR_MANAGER')
  deactivate(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.doctorsService.deactivate(id);
  }

  @Patch(':id/reactivate')
  @Roles('ADMIN', 'HR_MANAGER')
  reactivate(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.doctorsService.reactivate(id);
  }

  // ==========================================
  // DOCTOR SCHEDULES
  // ==========================================

  @Post(':id/schedules')
  @Roles('ADMIN', 'HR_MANAGER')
  createSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateDoctorScheduleDto,
  ) {
    return this.doctorsService.createSchedule(id, dto);
  }

  @Get(':id/schedules')
  @Roles('ADMIN', 'HR_MANAGER', 'RECEPTIONIST', 'DOCTOR')
  async getSchedules(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.verifyDoctorAccess(id, req);

    return this.doctorsService.getSchedules(id);
  }

  @Patch(':id/schedules/:scheduleId')
  @Roles('ADMIN', 'HR_MANAGER')
  updateSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
    @Body() dto: CreateDoctorScheduleDto,
  ) {
    return this.doctorsService.updateSchedule(
      id,
      scheduleId,
      dto,
    );
  }

  @Delete(':id/schedules/:scheduleId')
  @Roles('ADMIN', 'HR_MANAGER')
  deleteSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
  ) {
    return this.doctorsService.deleteSchedule(
      id,
      scheduleId,
    );
  }

  // ==========================================
  // DOCTOR AVAILABILITY
  // ==========================================

  @Post(':id/availability')
  @Roles('ADMIN', 'HR_MANAGER')
  setAvailability(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateDoctorAvailabilityDto,
  ) {
    return this.doctorsService.setAvailability(id, dto);
  }

 @Get(':id/availability')
@Roles('ADMIN', 'HR_MANAGER', 'RECEPTIONIST', 'DOCTOR')
async getAvailability(
  @Param('id', ParseIntPipe) id: number,
  @Req() req: AuthenticatedRequest,
  @Query('startDate') startDate?: string,
  @Query('endDate') endDate?: string,
) {
  await this.verifyDoctorAccess(id, req);

  return this.doctorsService.getAvailability(
    id,
    startDate,
    endDate,
  );
}

  @Get(':id/availability/date')
  @Roles('ADMIN', 'HR_MANAGER', 'RECEPTIONIST', 'DOCTOR')
  async getAvailabilityByDate(
    @Param('id', ParseIntPipe) id: number,
    @Query('date') date: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.verifyDoctorAccess(id, req);

    if (!date) {
      throw new BadRequestException('Date is required');
    }

    return this.doctorsService.getAvailabilityByDate(
      id,
      date,
    );
  }

  @Delete(':id/availability/:availabilityId')
  @Roles('ADMIN', 'HR_MANAGER')
  deleteAvailability(
    @Param('id', ParseIntPipe) id: number,
    @Param('availabilityId', ParseIntPipe)
    availabilityId: number,
  ) {
    return this.doctorsService.deleteAvailability(
      id,
      availabilityId,
    );
  }

  // ==========================================
  // DOCTOR LEAVE
  // ==========================================

  @Post(':id/leaves')
  @Roles('DOCTOR', 'ADMIN', 'HR_MANAGER')
  async createLeave(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateDoctorLeaveDto,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.verifyDoctorAccess(id, req);

    return this.doctorsService.createLeave(id, dto);
  }

  @Get(':id/leaves')
  @Roles('DOCTOR', 'ADMIN', 'HR_MANAGER')
  async getDoctorLeaves(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.verifyDoctorAccess(id, req);

    return this.doctorsService.getDoctorLeaves(id);
  }

  @Get('leaves/pending')
  @Roles('ADMIN', 'HR_MANAGER')
  getPendingLeaves() {
    return this.doctorsService.getPendingLeaves();
  }

  @Get('leaves/:leaveId')
  @Roles('ADMIN', 'HR_MANAGER', 'DOCTOR')
  async getLeave(
    @Param('leaveId', ParseIntPipe) leaveId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.verifyLeaveAccess(leaveId, req);

    return this.doctorsService.getLeave(leaveId);
  }

  @Patch('leaves/:leaveId/review')
  @Roles('ADMIN', 'HR_MANAGER')
  reviewLeave(
    @Param('leaveId', ParseIntPipe) leaveId: number,
    @Body() dto: ReviewDoctorLeaveDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.doctorsService.reviewLeave(
      leaveId,
      req.user.userId,
      dto,
    );
  }

  @Patch(':id/leaves/:leaveId/cancel')
  @Roles('DOCTOR', 'ADMIN')
  async cancelLeave(
    @Param('id', ParseIntPipe) id: number,
    @Param('leaveId', ParseIntPipe) leaveId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.verifyDoctorAccess(id, req);
    await this.verifyLeaveAccess(leaveId, req);

    return this.doctorsService.cancelLeave(id, leaveId);
  }
}

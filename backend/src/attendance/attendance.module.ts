import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';
import { AttendanceProfileService } from './services/attendance-profile.service.js';
import { AttendanceCheckInService } from './services/attendance-checkin.service.js';
import { AttendanceCheckOutService } from './services/attendance-checkout.service.js';
import { AttendanceReportService } from './services/attendance-report.service.js';
import { AttendanceCorrectionService } from './services/attendance-correction.service.js';
import { AttendanceStatisticsService } from './services/attendance-statistics.service.js';
@Module({
  imports:[PrismaModule], controllers:[AttendanceController],
  providers:[AttendanceService,AttendanceProfileService,AttendanceCheckInService,AttendanceCheckOutService,AttendanceReportService,AttendanceCorrectionService,AttendanceStatisticsService],
  exports:[AttendanceService],
})
export class AttendanceModule {}

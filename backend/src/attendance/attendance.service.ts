import { Injectable } from '@nestjs/common';
import { CheckInDto } from './dto/check-in.dto.js';
import { CheckOutDto } from './dto/check-out.dto.js';
import { UpdateAttendanceDto } from './dto/update-attendance.dto.js';
import { AttendanceCorrectionDto } from './dto/attendance-correction.dto.js';
import { ReviewCorrectionDto } from './dto/review-correction.dto.js';
import { AttendanceProfileService } from './services/attendance-profile.service.js';
import { AttendanceCheckInService } from './services/attendance-checkin.service.js';
import { AttendanceCheckOutService } from './services/attendance-checkout.service.js';
import { AttendanceReportService } from './services/attendance-report.service.js';
import { AttendanceCorrectionService } from './services/attendance-correction.service.js';
import { AttendanceStatisticsService } from './services/attendance-statistics.service.js';
import { LeaveService } from './services/leave.service.js';
import { CreateLeaveDto } from './dto/create-leave.dto.js';
import { ReviewLeaveDto } from './dto/review-leave.dto.js';
@Injectable()
export class AttendanceService {
  constructor(private readonly profile:AttendanceProfileService, private readonly checkins:AttendanceCheckInService, private readonly checkouts:AttendanceCheckOutService, private readonly reports:AttendanceReportService, private readonly corrections:AttendanceCorrectionService, private readonly stats:AttendanceStatisticsService, private readonly leaves:LeaveService) {}
  checkIn(dto:CheckInDto){return this.checkins.checkIn(dto);}
  checkOut(dto:CheckOutDto){return this.checkouts.checkOut(dto);}
  findAll(date?:string){return this.profile.findAll(date);}
  findOne(id:number){return this.profile.findOne(id);}
  update(id:number,dto:UpdateAttendanceDto){return this.profile.update(id,dto);}
  employeeHistory(id:number,from?:string,to?:string){return this.profile.findEmployeeHistory(id,from,to);}
  daily(date:string){return this.reports.daily(date);}
  monthly(month:string,employeeId?:number){return this.reports.monthly(month,employeeId);}
  createCorrection(id:number,dto:AttendanceCorrectionDto){return this.corrections.create(id,dto);}
  myCorrections(id:number){return this.corrections.findMine(id);}
  pendingCorrections(){return this.corrections.findPending();}
  reviewCorrection(id:number,reviewerId:number,dto:ReviewCorrectionDto){return this.corrections.review(id,reviewerId,dto);}
  overview(from?:string,to?:string){return this.stats.overview(from,to);}
  employeeStatistics(id:number,month?:string){return this.stats.employee(id,month);}
  createLeave(dto:CreateLeaveDto,userId:number){return this.leaves.create(dto,userId);}
  findLeaves(status?:string){return this.leaves.findAll(status);}
  findEmployeeLeaves(employeeId:number){return this.leaves.findEmployee(employeeId);}
  reviewLeave(id:number,reviewerId:number,dto:ReviewLeaveDto){return this.leaves.review(id,reviewerId,dto);}
}

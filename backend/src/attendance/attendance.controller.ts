import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service.js';
import { CheckInDto } from './dto/check-in.dto.js';
import { CheckOutDto } from './dto/check-out.dto.js';
import { UpdateAttendanceDto } from './dto/update-attendance.dto.js';
import { AttendanceCorrectionDto } from './dto/attendance-correction.dto.js';
import { ReviewCorrectionDto } from './dto/review-correction.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles/roles.guard.js';
import { Roles } from '../auth/roles/roles.decorator.js';
@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendance:AttendanceService) {}
  @Post('check-in') @Roles('ADMIN','HR_MANAGER','EMPLOYEE') checkIn(@Body() dto:CheckInDto){return this.attendance.checkIn(dto);}
  @Post('check-out') @Roles('ADMIN','HR_MANAGER','EMPLOYEE') checkOut(@Body() dto:CheckOutDto){return this.attendance.checkOut(dto);}
  @Get() @Roles('ADMIN','HR_MANAGER') findAll(@Query('date') date?:string){return this.attendance.findAll(date);}
  @Get('daily') @Roles('ADMIN','HR_MANAGER') daily(@Query('date') date:string){return this.attendance.daily(date);}
  @Get('monthly') @Roles('ADMIN','HR_MANAGER') monthly(@Query('month') month:string,@Query('employeeId') employeeId?:string){return this.attendance.monthly(month,employeeId?Number(employeeId):undefined);}
  @Get('statistics/overview') @Roles('ADMIN','HR_MANAGER') overview(@Query('from') from?:string,@Query('to') to?:string){return this.attendance.overview(from,to);}
  @Get('employee/:employeeId') @Roles('ADMIN','HR_MANAGER','EMPLOYEE') history(@Param('employeeId',ParseIntPipe) id:number,@Query('from') from?:string,@Query('to') to?:string){return this.attendance.employeeHistory(id,from,to);}
  @Get('employee/:employeeId/statistics') @Roles('ADMIN','HR_MANAGER') employeeStats(@Param('employeeId',ParseIntPipe) id:number,@Query('month') month?:string){return this.attendance.employeeStatistics(id,month);}
  @Patch(':id') @Roles('ADMIN','HR_MANAGER') update(@Param('id',ParseIntPipe) id:number,@Body() dto:UpdateAttendanceDto){return this.attendance.update(id,dto);}
  @Post('corrections') @Roles('ADMIN','HR_MANAGER','EMPLOYEE') createCorrection(@Body() dto:AttendanceCorrectionDto,@Req() req:any){return this.attendance.createCorrection(req.user.employeeId,dto);}
  @Get('corrections/mine') @Roles('ADMIN','HR_MANAGER','EMPLOYEE') myCorrections(@Req() req:any){return this.attendance.myCorrections(req.user.employeeId);}
  @Get('corrections/pending') @Roles('ADMIN','HR_MANAGER') pending(){return this.attendance.pendingCorrections();}
  @Patch('corrections/:id/review') @Roles('ADMIN','HR_MANAGER') review(@Param('id',ParseIntPipe) id:number,@Body() dto:ReviewCorrectionDto,@Req() req:any){return this.attendance.reviewCorrection(id,req.user.userId,dto);}
}

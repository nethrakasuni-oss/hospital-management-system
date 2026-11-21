
import { Module } from '@nestjs/common';

import { DoctorsController } from './doctors.controller.js';
import { DoctorsService } from './doctors.service.js';

import { DoctorProfileService } from './services/doctor-profile.service.js';
import { DoctorScheduleService } from './services/doctor-schedule.service.js';
import { DoctorAvailabilityService } from './services/doctor-availability.service.js';
import { DoctorLeaveService } from './services/doctor-leave.service.js';
import { DoctorSearchService } from './services/doctor-search.service.js';

import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [DoctorsController],
  providers: [
    DoctorsService,
    DoctorProfileService,
    DoctorScheduleService,
    DoctorAvailabilityService,
    DoctorLeaveService,
    DoctorSearchService,
  ],
  exports: [
    DoctorsService,
    DoctorProfileService,
    DoctorScheduleService,
    DoctorAvailabilityService,
    DoctorLeaveService,
    DoctorSearchService,
  ],
})
export class DoctorsModule {}

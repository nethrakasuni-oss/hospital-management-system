import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AppointmentsController } from './appointments.controller.js';
import { AppointmentsService } from './appointments.service.js';
import { AppointmentProfileService } from './services/appointment-profile.service.js';
import { AppointmentBookingService } from './services/appointment-booking.service.js';
import { AppointmentScheduleService } from './services/appointment-schedule.service.js';
import { AppointmentSearchService } from './services/appointment-search.service.js';
import { AppointmentStatisticsService } from './services/appointment-statistics.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [AppointmentsController],
  providers: [
    AppointmentsService,
    AppointmentProfileService,
    AppointmentBookingService,
    AppointmentScheduleService,
    AppointmentSearchService,
    AppointmentStatisticsService,
  ],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}

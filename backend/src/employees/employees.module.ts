import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { EmployeesController } from './employees.controller.js';
import { EmployeesService } from './employees.service.js';

import { EmployeeProfileService } from './services/employee-profile.service.js';
import { EmployeeAssignmentService } from './services/employee-assignment.service.js';
import { EmployeeSearchService } from './services/employee-search.service.js';
import { EmployeeStatisticsService } from './services/employee-statistics.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [EmployeesController],
  providers: [
    EmployeesService,
    EmployeeProfileService,
    EmployeeAssignmentService,
    EmployeeSearchService,
    EmployeeStatisticsService,
  ],
  exports: [EmployeesService],
})
export class EmployeesModule {}

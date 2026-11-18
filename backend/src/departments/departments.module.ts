
import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';

import { DepartmentsController } from './departments.controller.js';
import { DepartmentsService } from './departments.service.js';

import { DepartmentProfileService } from './services/department-profile.service.js';
import { DepartmentAssignmentService } from './services/department-assignment.service.js';
import { DepartmentSearchService } from './services/department-search.service.js';
import { DepartmentStatisticsService } from './services/department-statistics.service.js';

@Module({
  imports: [PrismaModule],

  controllers: [
    DepartmentsController,
  ],

  providers: [
    DepartmentsService,
    DepartmentProfileService,
    DepartmentAssignmentService,
    DepartmentSearchService,
    DepartmentStatisticsService,
  ],

  exports: [
    DepartmentsService,
    DepartmentProfileService,
    DepartmentAssignmentService,
    DepartmentSearchService,
    DepartmentStatisticsService,
  ],
})
export class DepartmentsModule {}

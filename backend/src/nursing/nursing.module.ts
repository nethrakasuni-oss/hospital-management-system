import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { NursingController } from './nursing.controller.js';
import { NursingService } from './nursing.service.js';
import { NursingAssignmentService } from './services/nursing-assignment.service.js';
import { NursingNoteService } from './services/nursing-note.service.js';
import { NursingObservationService } from './services/nursing-observation.service.js';
import { NursingCareWorkflowService } from './services/nursing-care-workflow.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [NursingController],
  providers: [NursingService, NursingAssignmentService, NursingNoteService, NursingObservationService, NursingCareWorkflowService],
  exports: [NursingService],
})
export class NursingModule {}

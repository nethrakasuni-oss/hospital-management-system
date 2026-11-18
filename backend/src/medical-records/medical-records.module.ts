import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { MedicalRecordsController } from './medical-records.controller.js';
import { MedicalRecordService } from './services/medical-record.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [MedicalRecordsController],
  providers: [MedicalRecordService],
  exports: [MedicalRecordService],
})
export class MedicalRecordsModule {}


import { Module } from '@nestjs/common';
import { InpatientController } from './inpatient.controller.js';
import { InpatientService } from './inpatient.service.js';

@Module({
  controllers: [InpatientController],
  providers: [InpatientService],
})
export class InpatientModule {}

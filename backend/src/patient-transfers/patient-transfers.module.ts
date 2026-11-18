import { Module } from '@nestjs/common';
import { PatientTransfersController } from './patient-transfers.controller.js';
import { PatientTransfersService } from './patient-transfers.service.js';
@Module({ controllers: [PatientTransfersController], providers: [PatientTransfersService], exports: [PatientTransfersService] })
export class PatientTransfersModule {}

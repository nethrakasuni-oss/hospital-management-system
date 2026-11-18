import { Module } from '@nestjs/common';
import { SurgeryController } from './surgery.controller.js';
import { SurgeryService } from './surgery.service.js';
@Module({ controllers: [SurgeryController], providers: [SurgeryService], exports: [SurgeryService] })
export class SurgeryModule {}

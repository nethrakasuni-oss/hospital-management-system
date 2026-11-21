import { Module } from '@nestjs/common';
import { DischargeController } from './discharge.controller.js';
import { DischargeService } from './discharge.service.js';
@Module({ controllers: [DischargeController], providers: [DischargeService], exports: [DischargeService] })
export class DischargeModule {}

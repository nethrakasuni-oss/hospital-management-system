import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PharmacyController } from './pharmacy.controller.js';
import { PharmacyService } from './services/pharmacy.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [PharmacyController],
  providers: [PharmacyService],
  exports: [PharmacyService],
})
export class PharmacyModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { InsuranceController } from './insurance.controller.js';
import { InsuranceService } from './insurance.service.js';
import { InsuranceProviderService } from './services/insurance-provider.service.js';
import { PatientInsuranceService } from './services/patient-insurance.service.js';
import { InsuranceClaimService } from './services/insurance-claim.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [InsuranceController],
  providers: [
    InsuranceService,
    InsuranceProviderService,
    PatientInsuranceService,
    InsuranceClaimService,
  ],
  exports: [InsuranceService],
})
export class InsuranceModule {}

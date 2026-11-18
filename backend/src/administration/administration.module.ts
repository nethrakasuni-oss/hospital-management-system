
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';

import { AdministrationController } from './administration.controller.js';
import { AdministrationService } from './administration.service.js';
import { PublicSettingsController } from './public-settings.controller.js';
import { StaffRegistrationService } from './staff-registration.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [
    AdministrationController,
    PublicSettingsController,
  ],
  providers: [
    AdministrationService,
    StaffRegistrationService,
  ],
  exports: [
    AdministrationService,
    StaffRegistrationService,
  ],
})
export class AdministrationModule {}

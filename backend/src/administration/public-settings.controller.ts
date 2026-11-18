import { Controller, Get } from '@nestjs/common';
import { AdministrationService } from './administration.service.js';

@Controller('admin/settings')
export class PublicSettingsController {
  constructor(private readonly service: AdministrationService) {}

  // Public read-only endpoint; only settings explicitly marked isPublic are returned.
  @Get('public')
  getPublicSettings() {
    return this.service.getPublicSettings();
  }
}

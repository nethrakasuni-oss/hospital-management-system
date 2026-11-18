
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import { DoctorAvailabilityStatus } from '../../generated/prisma/client.js';

export class CreateDoctorAvailabilityDto {
  @IsDateString()
  date: string;

  @IsEnum(DoctorAvailabilityStatus)
  status: DoctorAvailabilityStatus;

  // Required for AVAILABLE and EXTRA_HOURS.
  // Optional for UNAVAILABLE.
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

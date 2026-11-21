
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { LeaveStatus } from '../../generated/prisma/client.js';

export class ReviewDoctorLeaveDto {
  @IsEnum(LeaveStatus)
  status: LeaveStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNotes?: string;
}

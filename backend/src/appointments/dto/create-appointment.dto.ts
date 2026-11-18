import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum AppointmentTypeDto {
  IN_PERSON = 'IN_PERSON',
  ONLINE = 'ONLINE',
}

export class CreateAppointmentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  patientId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  doctorId!: number;

  @IsDateString()
  scheduledAt!: string;

  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(480)
  duration?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  consultationFee?: number;

  @IsOptional()
  @IsEnum(AppointmentTypeDto)
  appointmentType?: AppointmentTypeDto;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId?: number;
}

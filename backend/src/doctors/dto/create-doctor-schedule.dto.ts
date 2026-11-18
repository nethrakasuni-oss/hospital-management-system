
import {
  IsInt,
  IsOptional,
  IsString,
  IsBoolean,
  Min,
  Max,
  Matches,
} from 'class-validator';

export class CreateDoctorScheduleDto {
  // 0 = Sunday, 1 = Monday ... 6 = Saturday
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  // 24-hour format: HH:mm
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endTime: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  slotDurationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAppointments?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

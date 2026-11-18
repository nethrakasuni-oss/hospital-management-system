import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
export enum AttendanceStatusDto { PRESENT='PRESENT', ABSENT='ABSENT', HALF_DAY='HALF_DAY', ON_LEAVE='ON_LEAVE', HOLIDAY='HOLIDAY', WEEK_OFF='WEEK_OFF' }
export class UpdateAttendanceDto {
  @IsOptional() @IsDateString() checkIn?: string | null;
  @IsOptional() @IsDateString() checkOut?: string | null;
  @IsOptional() @IsEnum(AttendanceStatusDto) status?: AttendanceStatusDto;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) breakDurationMinutes?: number;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;
}

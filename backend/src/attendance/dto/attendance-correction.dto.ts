import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
export class AttendanceCorrectionDto {
  @IsDateString() requestedDate!: string;
  @IsOptional() @IsDateString() requestedCheckIn?: string;
  @IsOptional() @IsDateString() requestedCheckOut?: string;
  @IsString() @MaxLength(1000) reason!: string;
}

import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateLeaveDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId!: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  leaveType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

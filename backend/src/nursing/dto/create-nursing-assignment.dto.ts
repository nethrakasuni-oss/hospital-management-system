import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateNursingAssignmentDto {
  @Type(() => Number) @IsInt() @Min(1) patientId!: number;
  @Type(() => Number) @IsInt() @Min(1) employeeId!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) admissionId?: number;
  @IsOptional() @IsDateString() assignedAt?: string;
  @IsOptional() @IsString() @MaxLength(40) shift?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

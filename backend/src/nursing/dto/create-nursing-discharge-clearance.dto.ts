import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateNursingDischargeClearanceDto {
  @Type(() => Number) @IsInt() @Min(1) patientId!: number;
  @Type(() => Number) @IsInt() @Min(1) admissionId!: number;
  @IsOptional() @IsString() @MaxLength(5000) nursingDischargeNotes?: string;
  @IsOptional() @IsString() @MaxLength(5000) patientEducation?: string;
  @IsBoolean() nursingClearance!: boolean;
  @IsBoolean() documentationComplete!: boolean;
}

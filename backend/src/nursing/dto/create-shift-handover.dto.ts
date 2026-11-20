import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateShiftHandoverDto {
  @Type(() => Number) @IsInt() @Min(1) patientId!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) admissionId?: number;
  @Type(() => Number) @IsInt() @Min(1) incomingNurseUserId!: number;
  @IsString() @MaxLength(10000) patientSummary!: string;
  @IsString() @MaxLength(5000) currentCondition!: string;
  @IsOptional() @IsString() @MaxLength(5000) pendingMedications?: string;
  @IsOptional() @IsString() @MaxLength(5000) pendingInvestigations?: string;
  @IsOptional() @IsString() @MaxLength(5000) importantObservations?: string;
  @IsOptional() @IsString() @MaxLength(5000) escalationNotes?: string;
  @IsOptional() @IsDateString() handedOverAt?: string;
}

import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateMedicalRecordDto {
  @Type(() => Number) @IsInt() @Min(1) patientId!: number;
  @Type(() => Number) @IsInt() @Min(1) doctorId!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) appointmentId?: number;
  @IsOptional() @IsString() @MaxLength(5000) diagnosis?: string;
  @IsOptional() @IsString() @MaxLength(5000) symptoms?: string;
  @IsOptional() @IsString() @MaxLength(5000) treatment?: string;
  @IsOptional() @IsString() @MaxLength(10000) notes?: string;
  @IsOptional() @IsString() @MaxLength(5000) chiefComplaint?: string;
  @IsOptional() @IsString() @MaxLength(10000) historyPresentIllness?: string;
  @IsOptional() @IsString() @MaxLength(10000) previousMedicalHistory?: string;
  @IsOptional() @IsString() @MaxLength(5000) currentMedications?: string;
  @IsOptional() @IsString() @MaxLength(5000) allergies?: string;
  @IsOptional() @IsString() @MaxLength(50) bloodPressure?: string;
  @IsOptional() @IsString() @MaxLength(50) pulse?: string;
  @IsOptional() @IsString() @MaxLength(50) temperature?: string;
  @IsOptional() @IsString() @MaxLength(50) respiratoryRate?: string;
  @IsOptional() @IsString() @MaxLength(50) oxygenSaturation?: string;
  @IsOptional() @IsString() @MaxLength(50) weight?: string;
  @IsOptional() @IsString() @MaxLength(50) height?: string;
  @IsOptional() @IsString() @MaxLength(10000) physicalExamination?: string;
  @IsOptional() @IsString() @MaxLength(5000) followUpRecommendations?: string;
}

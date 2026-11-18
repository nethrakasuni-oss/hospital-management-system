import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMedicalRecordDto {
  @IsOptional() @IsString() @MaxLength(5000) diagnosis?: string | null;
  @IsOptional() @IsString() @MaxLength(5000) symptoms?: string | null;
  @IsOptional() @IsString() @MaxLength(5000) treatment?: string | null;
  @IsOptional() @IsString() @MaxLength(10000) notes?: string | null;
  @IsOptional() @IsString() @MaxLength(5000) chiefComplaint?: string | null;
  @IsOptional() @IsString() @MaxLength(10000) historyPresentIllness?: string | null;
  @IsOptional() @IsString() @MaxLength(10000) previousMedicalHistory?: string | null;
  @IsOptional() @IsString() @MaxLength(5000) currentMedications?: string | null;
  @IsOptional() @IsString() @MaxLength(5000) allergies?: string | null;
  @IsOptional() @IsString() @MaxLength(50) bloodPressure?: string | null;
  @IsOptional() @IsString() @MaxLength(50) pulse?: string | null;
  @IsOptional() @IsString() @MaxLength(50) temperature?: string | null;
  @IsOptional() @IsString() @MaxLength(50) respiratoryRate?: string | null;
  @IsOptional() @IsString() @MaxLength(50) oxygenSaturation?: string | null;
  @IsOptional() @IsString() @MaxLength(50) weight?: string | null;
  @IsOptional() @IsString() @MaxLength(50) height?: string | null;
  @IsOptional() @IsString() @MaxLength(10000) physicalExamination?: string | null;
  @IsOptional() @IsString() @MaxLength(5000) followUpRecommendations?: string | null;
}

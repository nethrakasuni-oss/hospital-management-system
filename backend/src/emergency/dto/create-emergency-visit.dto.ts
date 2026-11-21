import { IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateEmergencyVisitDto {
  @IsInt() @Min(1) patientId!: number;
  @IsIn(['RESUSCITATION', 'EMERGENCY', 'URGENT', 'LESS_URGENT', 'NON_URGENT'])
  triageLevel!: string;
  @IsString() @IsNotEmpty() chiefComplaint!: string;
  @IsOptional() @IsString() clinicalNotes?: string;
  @IsOptional() vitalSigns?: Record<string, unknown>;
  @IsOptional() @IsInt() @Min(1) admissionId?: number;
  @IsOptional() @IsInt() @Min(1) attendingDoctorId?: number;
  @IsOptional() @IsDateString() arrivalAt?: string;
}

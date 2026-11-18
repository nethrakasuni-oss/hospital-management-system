import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateEmergencyVisitDto {
  @IsOptional() @IsIn(['RESUSCITATION', 'EMERGENCY', 'URGENT', 'LESS_URGENT', 'NON_URGENT']) triageLevel?: string;
  @IsOptional() @IsIn(['REGISTERED', 'TRIAGED', 'UNDER_TREATMENT', 'OBSERVATION', 'ADMITTED', 'DISCHARGED', 'TRANSFERRED', 'LEFT_WITHOUT_BEING_SEEN', 'CANCELLED']) status?: string;
  @IsOptional() @IsString() chiefComplaint?: string;
  @IsOptional() @IsString() clinicalNotes?: string;
  @IsOptional() vitalSigns?: Record<string, unknown>;
  @IsOptional() @IsString() disposition?: string;
  @IsOptional() @IsInt() @Min(1) admissionId?: number;
  @IsOptional() @IsInt() @Min(1) attendingDoctorId?: number;
}

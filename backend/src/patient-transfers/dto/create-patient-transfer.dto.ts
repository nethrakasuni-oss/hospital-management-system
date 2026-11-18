import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
export class CreatePatientTransferDto {
  @IsInt() @Min(1) patientId!: number;
  @IsOptional() @IsInt() @Min(1) admissionId?: number;
  @IsOptional() @IsInt() @Min(1) fromWardId?: number;
  @IsInt() @Min(1) toWardId!: number;
  @IsOptional() @IsInt() @Min(1) fromBedId?: number;
  @IsOptional() @IsInt() @Min(1) toBedId?: number;
  @IsString() @IsNotEmpty() reason!: string;
  @IsOptional() @IsString() notes?: string;
}

import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
export class CreateDischargeSummaryDto {
  @IsInt() @Min(1) patientId!: number;
  @IsInt() @Min(1) admissionId!: number;
  @IsDateString() admissionDate!: string;
  @IsOptional() @IsDateString() dischargeDate?: string;
  @IsString() @IsNotEmpty() principalDiagnosis!: string;
  @IsOptional() @IsString() secondaryDiagnoses?: string;
  @IsOptional() @IsString() proceduresPerformed?: string;
  @IsString() @IsNotEmpty() treatmentSummary!: string;
  @IsOptional() @IsString() dischargeMedication?: string;
  @IsOptional() @IsString() followUpInstructions?: string;
  @IsOptional() @IsString() conditionAtDischarge?: string;
}

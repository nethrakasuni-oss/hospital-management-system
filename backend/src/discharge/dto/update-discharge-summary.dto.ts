import { IsOptional, IsString } from 'class-validator';
export class UpdateDischargeSummaryDto {
  @IsOptional() @IsString() principalDiagnosis?: string;
  @IsOptional() @IsString() secondaryDiagnoses?: string;
  @IsOptional() @IsString() proceduresPerformed?: string;
  @IsOptional() @IsString() treatmentSummary?: string;
  @IsOptional() @IsString() dischargeMedication?: string;
  @IsOptional() @IsString() followUpInstructions?: string;
  @IsOptional() @IsString() conditionAtDischarge?: string;
}

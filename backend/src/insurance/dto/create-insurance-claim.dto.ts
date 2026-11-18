import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateInsuranceClaimDto {
  @Type(() => Number) @IsInt() @Min(1) patientId!: number;
  @Type(() => Number) @IsInt() @Min(1) providerId!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) patientInsuranceId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) invoiceId?: number;
  @Type(() => Number) @IsNumber() @Min(0.01) claimedAmount!: number;
  @IsOptional() @IsString() @MaxLength(4000) reviewNotes?: string;
}

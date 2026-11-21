import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
export class CreateClaimDto {
  @Type(() => Number) @IsInt() @Min(1) patientId!: number;
  @Type(() => Number) @IsInt() @Min(1) providerId!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) patientInsuranceId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) invoiceId?: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) claimedAmount!: number;
}

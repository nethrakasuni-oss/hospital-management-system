import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreatePatientInsuranceDto {
  @Type(() => Number) @IsInt() @Min(1) patientId!: number;
  @Type(() => Number) @IsInt() @Min(1) providerId!: number;
  @IsString() @MaxLength(100) policyNumber!: string;
  @IsOptional() @IsString() @MaxLength(100) memberNumber?: string;
  @IsOptional() @IsDateString() coverageStart?: string;
  @IsOptional() @IsDateString() coverageEnd?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) coverageLimit?: number;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

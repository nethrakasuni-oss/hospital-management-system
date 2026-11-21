import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdatePatientInsuranceDto {
  @IsOptional() @IsString() @MaxLength(100) policyNumber?: string;
  @IsOptional() @IsString() @MaxLength(100) memberNumber?: string | null;
  @IsOptional() @IsDateString() coverageStart?: string | null;
  @IsOptional() @IsDateString() coverageEnd?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) coverageLimit?: number | null;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;
}

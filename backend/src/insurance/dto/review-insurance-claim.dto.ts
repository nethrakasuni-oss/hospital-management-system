import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ReviewInsuranceClaimDto {
  @IsIn(['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED']) status!: 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED';
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) approvedAmount?: number;
  @IsOptional() @IsString() @MaxLength(4000) reviewNotes?: string;
}

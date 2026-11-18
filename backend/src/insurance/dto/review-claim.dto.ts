import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
export class ReviewClaimDto {
  @IsIn(['UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'])
  status!: 'UNDER_REVIEW' | 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED';
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) approvedAmount?: number;
  @IsOptional() @IsString() @MaxLength(3000) reviewNotes?: string;
}

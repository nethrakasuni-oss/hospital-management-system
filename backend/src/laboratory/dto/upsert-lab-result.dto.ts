import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpsertLabResultDto {
  @Type(() => Number) @IsInt() @Min(1) labRequestItemId!: number;
  @IsOptional() @IsString() @MaxLength(5000) resultValue?: string;
  @IsOptional() @IsString() @MaxLength(1000) referenceRange?: string;
  @IsOptional() @IsString() @MaxLength(5000) remarks?: string;
  @IsOptional() @IsString() @MaxLength(50) unit?: string;
  @IsOptional() @IsIn(['NORMAL', 'HIGH', 'LOW']) abnormalFlag?: 'NORMAL' | 'HIGH' | 'LOW';
  @IsOptional() @IsBoolean() critical?: boolean;
  @IsOptional() @IsString() @MaxLength(5000) comments?: string;
  @IsOptional() @IsString() @MaxLength(2000) amendmentReason?: string;
}

import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CollectLabSampleDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  labRequestId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sampleType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  barcode?: string;

  @IsOptional()
  @IsDateString()
  collectedAt?: string;

  @IsOptional()
  @IsBoolean()
  rejected?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rejectionReason?: string;
}

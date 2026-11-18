import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpsertLabResultDto {
  @Type(() => Number) @IsInt() @Min(1) labRequestItemId!: number;
  @IsOptional() @IsString() @MaxLength(5000) resultValue?: string;
  @IsOptional() @IsString() @MaxLength(1000) referenceRange?: string;
  @IsOptional() @IsString() @MaxLength(5000) remarks?: string;
}

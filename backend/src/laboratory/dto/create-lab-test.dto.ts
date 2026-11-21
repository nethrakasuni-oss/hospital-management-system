import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLabTestDto {
  @IsString() @MaxLength(40) code!: string;
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(120) category?: string;
  @IsOptional() @IsString() @MaxLength(120) sampleType?: string;
  @IsOptional() @IsString() @MaxLength(1000) referenceRange?: string;
  @IsOptional() @IsString() @MaxLength(50) unit?: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price!: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

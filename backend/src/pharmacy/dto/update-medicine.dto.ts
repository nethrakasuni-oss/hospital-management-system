import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
export class UpdateMedicineDto {
  @IsOptional() @IsString() @MaxLength(180) name?: string;
  @IsOptional() @IsString() @MaxLength(180) genericName?: string | null;
  @IsOptional() @IsString() @MaxLength(180) manufacturer?: string | null;
  @IsOptional() @IsString() @MaxLength(50) unit?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) sellingPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) categoryId?: number | null;
  @IsOptional() @IsBoolean() active?: boolean;
}

import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
export class CreateMedicineDto {
  @IsString() @MaxLength(40) code!: string;
  @IsString() @MaxLength(180) name!: string;
  @IsOptional() @IsString() @MaxLength(180) genericName?: string;
  @IsOptional() @IsString() @MaxLength(180) manufacturer?: string;
  @IsString() @MaxLength(50) unit!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) sellingPrice!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) categoryId?: number;
}

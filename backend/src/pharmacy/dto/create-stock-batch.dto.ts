import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
export class CreateStockBatchDto {
  @Type(() => Number) @IsInt() @Min(1) medicineId!: number;
  @IsString() @MaxLength(100) batchNumber!: string;
  @Type(() => Number) @IsInt() @Min(1) quantity!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) costPrice!: number;
  @IsOptional() @IsDateString() expiryDate?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) supplierId?: number;
}

import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
export class AdjustStockDto {
  @Type(() => Number) @IsInt() @Min(1) medicineId!: number;
  @Type(() => Number) @IsInt() @Min(1) quantity!: number;
  @IsIn(['ADJUSTMENT', 'RETURN', 'EXPIRED']) type!: 'ADJUSTMENT' | 'RETURN' | 'EXPIRED';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) batchId?: number;
  @IsString() @MaxLength(1000) notes!: string;
}

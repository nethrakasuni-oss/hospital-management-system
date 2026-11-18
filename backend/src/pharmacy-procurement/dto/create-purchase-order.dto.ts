import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
export class CreatePurchaseOrderItemDto {
  @Type(() => Number) @IsInt() @Min(1) medicineId!: number;
  @Type(() => Number) @IsInt() @Min(1) quantityOrdered!: number;
  @Type(() => Number) @IsNumber() @Min(0) unitCost!: number;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
}
export class CreatePurchaseOrderDto {
  @Type(() => Number) @IsInt() @Min(1) supplierId!: number;
  @IsOptional() @IsDateString() expectedAt?: string;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CreatePurchaseOrderItemDto) items!: CreatePurchaseOrderItemDto[];
}

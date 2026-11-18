import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
export class ReceivePurchaseOrderLineDto {
  @Type(() => Number) @IsInt() @Min(1) itemId!: number;
  @Type(() => Number) @IsInt() @Min(1) quantityReceived!: number;
  @IsString() @MaxLength(100) batchNumber!: string;
  @IsOptional() @IsDateString() expiryDate?: string;
}
export class ReceivePurchaseOrderDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => ReceivePurchaseOrderLineDto) items!: ReceivePurchaseOrderLineDto[];
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

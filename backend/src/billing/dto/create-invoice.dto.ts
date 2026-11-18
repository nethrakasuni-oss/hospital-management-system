import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';

export class CreateInvoiceItemDto {
  @IsString() @MaxLength(500) description!: string;
  @Type(() => Number) @IsInt() @Min(1) quantity!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) unitPrice!: number;
}
export class CreateInvoiceDto {
  @Type(() => Number) @IsInt() @Min(1) patientId!: number;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CreateInvoiceItemDto) items!: CreateInvoiceItemDto[];
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

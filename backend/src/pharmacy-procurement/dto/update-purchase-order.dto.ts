import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
export class UpdatePurchaseOrderDto {
  @IsOptional() @IsDateString() expectedAt?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string | null;
}

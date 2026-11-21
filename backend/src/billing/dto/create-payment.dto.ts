import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
export class CreatePaymentDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount!: number;
  @IsIn(['CASH','CARD','BANK_TRANSFER','CHEQUE','INSURANCE','OTHER']) method!: string;
  @IsOptional() @IsString() @MaxLength(160) reference?: string;
}

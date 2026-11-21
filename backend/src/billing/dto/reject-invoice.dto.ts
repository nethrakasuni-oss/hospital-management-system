import { IsString, MaxLength, MinLength } from 'class-validator';
export class RejectInvoiceDto {
  @IsString() @MinLength(3) @MaxLength(2000) reason!: string;
}

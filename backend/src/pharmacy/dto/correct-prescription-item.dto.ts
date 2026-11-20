import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class CorrectPrescriptionItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  medicineId!: number;
}

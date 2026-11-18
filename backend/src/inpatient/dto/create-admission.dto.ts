
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAdmissionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  patientId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  bedId!: number;

  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  reason?: string;
}

import { Type } from 'class-transformer';
import { IsEnum, IsDateString, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export enum MedicationAdministrationStatusDto {
  ADMINISTERED = 'ADMINISTERED',
  MISSED = 'MISSED',
  WITHHELD = 'WITHHELD',
}

export class CreateMedicationAdministrationDto {
  @Type(() => Number) @IsInt() @Min(1) patientId!: number;
  @Type(() => Number) @IsInt() @Min(1) prescriptionId!: number;
  @IsEnum(MedicationAdministrationStatusDto) status!: MedicationAdministrationStatusDto;
  @IsDateString() administeredAt!: string;
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

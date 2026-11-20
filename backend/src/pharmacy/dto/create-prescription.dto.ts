import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';

export class CreatePrescriptionItemDto {
  @Type(() => Number) @IsInt() @Min(1) medicineId!: number;
  @IsString() @MaxLength(255) medicineName!: string;
  @IsString() @MaxLength(255) dosage!: string;
  @IsString() @MaxLength(255) frequency!: string;
  @IsOptional() @IsString() @MaxLength(255) duration?: string;
  @IsOptional() @IsString() @MaxLength(1000) instructions?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) quantity?: number;
}

export class CreatePrescriptionDto {
  @Type(() => Number) @IsInt() @Min(1) patientId!: number;
  @Type(() => Number) @IsInt() @Min(1) doctorId!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) medicalRecordId?: number;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CreatePrescriptionItemDto)
  items!: CreatePrescriptionItemDto[];
}

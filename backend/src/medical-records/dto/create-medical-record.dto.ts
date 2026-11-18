import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateMedicalRecordDto {
  @Type(() => Number) @IsInt() @Min(1) patientId!: number;
  @Type(() => Number) @IsInt() @Min(1) doctorId!: number;
  @IsOptional() @IsString() @MaxLength(5000) diagnosis?: string;
  @IsOptional() @IsString() @MaxLength(5000) symptoms?: string;
  @IsOptional() @IsString() @MaxLength(5000) treatment?: string;
  @IsOptional() @IsString() @MaxLength(10000) notes?: string;
}

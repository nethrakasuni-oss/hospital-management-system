import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateLabRequestDto {
  @Type(() => Number) @IsInt() @Min(1) patientId!: number;
  @Type(() => Number) @IsInt() @Min(1) doctorId!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) medicalRecordId?: number;
  @IsArray() @ArrayMinSize(1) @Type(() => Number) @IsInt({ each: true }) @Min(1, { each: true }) labTestIds!: number[];
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
}

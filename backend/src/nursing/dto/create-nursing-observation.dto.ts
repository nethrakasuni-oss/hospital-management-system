import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateNursingObservationDto {
  @Type(() => Number) @IsInt() @Min(1) patientId!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) assignmentId?: number;
  @IsOptional() @IsDateString() observedAt?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(25) @Max(45) temperatureC?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(40) @Max(300) systolicBP?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(20) @Max(200) diastolicBP?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(20) @Max(250) pulseBpm?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) respiratoryRate?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) oxygenSaturation?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) bloodGlucose?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) weightKg?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) heightCm?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10) painScore?: number;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

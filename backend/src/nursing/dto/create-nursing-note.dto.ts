import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateNursingNoteDto {
  @Type(() => Number) @IsInt() @Min(1) patientId!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) assignmentId?: number;
  @IsOptional() @IsString() @MaxLength(60) noteType?: string;
  @IsString() @MaxLength(10000) content!: string;
  @IsOptional() @IsDateString() recordedAt?: string;
}

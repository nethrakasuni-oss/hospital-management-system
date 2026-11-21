import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateNursingNoteDto {
  @IsOptional() @IsString() @MaxLength(60) noteType?: string;
  @IsOptional() @IsString() @MaxLength(10000) content?: string;
  @IsOptional() @IsDateString() recordedAt?: string;
}

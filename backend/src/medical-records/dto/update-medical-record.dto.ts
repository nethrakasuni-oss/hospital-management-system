import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMedicalRecordDto {
  @IsOptional() @IsString() @MaxLength(5000) diagnosis?: string | null;
  @IsOptional() @IsString() @MaxLength(5000) symptoms?: string | null;
  @IsOptional() @IsString() @MaxLength(5000) treatment?: string | null;
  @IsOptional() @IsString() @MaxLength(10000) notes?: string | null;
}

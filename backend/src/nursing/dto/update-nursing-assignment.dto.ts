import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateNursingAssignmentDto {
  @IsOptional() @IsDateString() assignedAt?: string;
  @IsOptional() @IsDateString() endedAt?: string | null;
  @IsOptional() @IsString() @MaxLength(40) shift?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}

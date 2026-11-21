
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateWardDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  departmentId?: number | null;
}

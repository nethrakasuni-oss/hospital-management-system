
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateWardDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  departmentId?: number;
}

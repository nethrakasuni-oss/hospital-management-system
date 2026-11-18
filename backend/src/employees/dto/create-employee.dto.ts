import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateEmployeeDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  employeeNo!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  designation!: string;

  @IsOptional()
  @IsDateString()
  joinedDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId?: number;
}

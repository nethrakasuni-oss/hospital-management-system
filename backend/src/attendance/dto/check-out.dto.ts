import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
export class CheckOutDto {
  @Type(() => Number) @IsInt() @Min(1) employeeId!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) breakDurationMinutes?: number;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

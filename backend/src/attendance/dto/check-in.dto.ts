import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
export class CheckInDto {
  @Type(() => Number) @IsInt() @Min(1) employeeId!: number;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

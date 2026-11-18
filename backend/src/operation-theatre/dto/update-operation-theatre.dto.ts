import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
export class UpdateOperationTheatreDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsIn(['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'UNAVAILABLE']) status?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

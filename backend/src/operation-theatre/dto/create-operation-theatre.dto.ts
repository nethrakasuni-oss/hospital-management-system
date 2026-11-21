import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
export class CreateOperationTheatreDto {
  @IsString() @IsNotEmpty() theatreCode!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsIn(['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'UNAVAILABLE']) status?: string;
}

import { IsDateString, IsOptional, IsString } from 'class-validator';
export class UpdateSurgeryBookingDto {
  @IsOptional() @IsString() procedureName?: string;
  @IsOptional() @IsDateString() plannedStartAt?: string;
  @IsOptional() @IsDateString() plannedEndAt?: string;
  @IsOptional() @IsString() preOpNotes?: string;
  @IsOptional() @IsString() postOpNotes?: string;
}

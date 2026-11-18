import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
export class CreateSurgeryBookingDto {
  @IsString() @IsNotEmpty() procedureName!: string;
  @IsDateString() plannedStartAt!: string;
  @IsDateString() plannedEndAt!: string;
  @IsInt() @Min(1) patientId!: number;
  @IsOptional() @IsInt() @Min(1) admissionId?: number;
  @IsInt() @Min(1) doctorId!: number;
  @IsInt() @Min(1) theatreId!: number;
  @IsOptional() @IsString() preOpNotes?: string;
}

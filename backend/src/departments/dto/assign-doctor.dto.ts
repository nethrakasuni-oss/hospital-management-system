
import {
  IsInt,
  IsPositive,
} from 'class-validator';

export class AssignDoctorDto {
  @IsInt()
  @IsPositive()
  doctorId: number;
}

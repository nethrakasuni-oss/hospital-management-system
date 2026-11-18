
import {
  IsInt,
  IsPositive,
} from 'class-validator';

export class AssignDepartmentHeadDto {
  @IsInt()
  @IsPositive()
  employeeId: number;
}

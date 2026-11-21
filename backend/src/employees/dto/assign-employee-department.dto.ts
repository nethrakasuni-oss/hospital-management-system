import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class AssignEmployeeDepartmentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId!: number;
}

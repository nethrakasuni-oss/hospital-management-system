import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateUserAdminDto {
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'SUSPENDED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

  @IsOptional()
  @IsInt()
  @Min(1)
  roleId?: number;
}

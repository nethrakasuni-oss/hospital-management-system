import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class VerifyLabResultDto {
  @IsIn(['VERIFY', 'REJECT'])
  action!: 'VERIFY' | 'REJECT';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

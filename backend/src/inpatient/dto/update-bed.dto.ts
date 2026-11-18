
import { IsIn, IsOptional } from 'class-validator';

export class UpdateBedDto {
  @IsOptional()
  @IsIn(['AVAILABLE', 'MAINTENANCE', 'UNAVAILABLE'])
  status?: string;
}

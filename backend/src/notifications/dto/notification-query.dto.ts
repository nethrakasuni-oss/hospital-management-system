import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class NotificationQueryDto {
  @IsOptional() @IsIn(['PENDING','SENT','READ','FAILED']) status?: string;
  @IsOptional() @IsIn(['IN_APP','EMAIL','SMS']) channel?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

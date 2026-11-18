import { IsEmail, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateNotificationDto {
  @IsString() @MaxLength(180) title!: string;
  @IsString() @MaxLength(5000) message!: string;
  @IsOptional() @IsIn(['SYSTEM','APPOINTMENT','LAB_RESULT','PRESCRIPTION','BILLING','ADMISSION','LEAVE']) type?: string;
  @IsOptional() @IsIn(['IN_APP','EMAIL','SMS']) channel?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) userId?: number;
  @IsOptional() @IsEmail() @MaxLength(254) recipientEmail?: string;
  @IsOptional() @IsString() @MaxLength(40) recipientPhone?: string;
  @IsOptional() metadata?: Record<string, unknown>;
}

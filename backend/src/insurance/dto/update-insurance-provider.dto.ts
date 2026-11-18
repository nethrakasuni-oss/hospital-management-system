import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateInsuranceProviderDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(40) code?: string | null;
  @IsOptional() @IsString() @MaxLength(160) contactPerson?: string | null;
  @IsOptional() @IsEmail() @MaxLength(160) email?: string | null;
  @IsOptional() @IsString() @MaxLength(40) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) address?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

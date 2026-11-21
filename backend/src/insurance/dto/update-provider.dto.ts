import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
export class UpdateProviderDto {
  @IsOptional() @IsString() @MaxLength(180) name?: string;
  @IsOptional() @IsString() @MaxLength(180) contactPerson?: string | null;
  @IsOptional() @IsEmail() @MaxLength(180) email?: string | null;
  @IsOptional() @IsString() @MaxLength(40) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) address?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

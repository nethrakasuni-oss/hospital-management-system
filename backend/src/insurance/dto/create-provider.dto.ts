import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
export class CreateProviderDto {
  @IsString() @MaxLength(180) name!: string;
  @IsOptional() @IsString() @MaxLength(40) code?: string;
  @IsOptional() @IsString() @MaxLength(180) contactPerson?: string;
  @IsOptional() @IsEmail() @MaxLength(180) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(1000) address?: string;
}

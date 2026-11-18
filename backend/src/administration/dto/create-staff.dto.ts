import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';


export class CreateStaffDto {
@IsString()
@MaxLength(80)
firstName!: string;

@IsString()
@MaxLength(80)
lastName!: string;

@IsEmail()
@MaxLength(254)
email!: string;

@IsOptional()
@IsString()
@MaxLength(30)
phone?: string;

@IsString()
@MinLength(8)
@MaxLength(100)
password!: string;

@IsString()
@MaxLength(40)
role!: string;

@IsOptional()
@Type(() => Number)
@IsInt()
@Min(1)
departmentId?: number;

// Employee-specific fields
@IsOptional()
@IsString()
@MaxLength(50)
employeeNo?: string;

@IsOptional()
@IsString()
@MaxLength(100)
designation?: string;

@IsOptional()
@IsDateString()
joinedDate?: string;

// Doctor-specific fields
@IsOptional()
@IsString()
@MaxLength(50)
registrationNo?: string;

@IsOptional()
@IsString()
@MaxLength(150)
specialization?: string;

@IsOptional()
@IsString()
@MaxLength(150)
qualification?: string;

@IsOptional()
@Type(() => Number)
@IsNumber()
@Min(0)
consultationFee?: number;
}
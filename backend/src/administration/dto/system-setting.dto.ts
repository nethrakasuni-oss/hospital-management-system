import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertSystemSettingDto {
  @IsString()
  @MaxLength(120)
  key!: string;

  // JSON values are intentionally accepted as unknown; the service validates serializability.
  value!: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

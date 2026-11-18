import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateLabRequestStatusDto {
  @IsIn(['REQUESTED', 'SAMPLE_COLLECTED', 'PROCESSING', 'COMPLETED', 'CANCELLED'])
  status!: 'REQUESTED' | 'SAMPLE_COLLECTED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
}

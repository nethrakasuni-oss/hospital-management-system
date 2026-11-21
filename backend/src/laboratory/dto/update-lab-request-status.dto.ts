import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateLabRequestStatusDto {
  @IsIn(['REQUESTED', 'SAMPLE_PENDING', 'SAMPLE_COLLECTED', 'RECEIVED', 'PROCESSING', 'RESULT_ENTERED', 'VERIFIED', 'COMPLETED', 'REJECTED', 'CANCELLED'])
  status!: 'REQUESTED' | 'SAMPLE_PENDING' | 'SAMPLE_COLLECTED' | 'RECEIVED' | 'PROCESSING' | 'RESULT_ENTERED' | 'VERIFIED' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
}

import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
export enum CorrectionReviewStatusDto { APPROVED='APPROVED', REJECTED='REJECTED' }
export class ReviewCorrectionDto {
  @IsEnum(CorrectionReviewStatusDto) status!: CorrectionReviewStatusDto;
  @IsOptional() @IsString() @MaxLength(1000) reviewNotes?: string;
}

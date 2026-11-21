
import { Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min } from 'class-validator';

export class CreateBedDto {
  @IsString()
  @MaxLength(40)
  bedNumber!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  roomId!: number;
}

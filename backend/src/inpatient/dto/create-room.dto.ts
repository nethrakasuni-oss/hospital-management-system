
import { Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @MaxLength(40)
  roomNumber!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  wardId!: number;
}

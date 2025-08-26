import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UploadBase64ImageDto {
  @ApiProperty()
  @IsString()
  image: string;

  @ApiProperty()
  @IsString()
  route: string;


}

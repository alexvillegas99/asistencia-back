// src/modules/media/dto/complete-upload.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class CompleteUploadDto {
  // con esto basta si no usas DB
  @IsString() @IsNotEmpty()
  key: string;
}

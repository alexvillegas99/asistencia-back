// src/modules/skool/post/dto/update-post.dto.ts
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePostDto {
  @IsOptional() @IsString() @MaxLength(200)
  title?: string;

  @IsOptional() @IsString()
  body?: string;

  @IsOptional()
  attachments?: string[];

  @IsOptional() @IsBoolean()
  pinned?: boolean;
}

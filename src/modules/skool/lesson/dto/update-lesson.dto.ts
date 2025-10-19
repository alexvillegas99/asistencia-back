// src/modules/skool/lesson/dto/update-lesson.dto.ts
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateLessonDto {
  @IsOptional() @IsString()
  title?: string;

  @IsOptional() @IsString()
  content?: string;

  @IsOptional() @IsString()
  videoMediaId?: string;

  @IsOptional() @IsString()
  videoKey?: string;

  @IsOptional()
  attachments?: string[];

  @IsOptional() @IsNumber()
  durationSec?: number;

  @IsOptional() @IsNumber()
  sortIndex?: number;

  @IsOptional() @IsEnum(['draft','published','archived'] as any)
  status?: 'draft' | 'published' | 'archived';

  @IsOptional() @IsBoolean()
  isPreview?: boolean;
}

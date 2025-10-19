// src/modules/skool/lesson/dto/create-lesson.dto.ts
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateLessonDto {
  @IsString()
  courseId: string;

  @IsString()
  title: string;

  @IsOptional() @IsString()
  content?: string;

  @IsOptional() @IsString()
  videoMediaId?: string;

  @IsOptional() @IsString()
  videoKey?: string;

  @IsOptional()
  attachments?: string[]; // mediaIds

  @IsOptional() @IsNumber()
  durationSec?: number;

  @IsOptional() @IsNumber()
  sortIndex?: number;

  @IsOptional() @IsEnum(['draft','published','archived'] as any)
  status?: 'draft' | 'published' | 'archived';

  @IsOptional() @IsBoolean()
  isPreview?: boolean;
}

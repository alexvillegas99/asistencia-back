// src/modules/skool/course/dto/update-course.dto.ts
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateCourseDto {
  @IsOptional() @IsString()
  title?: string;

  @IsOptional() @IsString()
  category?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  coverMediaId?: string;

  @IsOptional() @IsEnum(['public','private'] as any)
  visibility?: 'public' | 'private';

  @IsOptional() @IsEnum(['draft','published','archived'] as any)
  status?: 'draft' | 'published' | 'archived';

  @IsOptional()
  sortIndex?: number;
}

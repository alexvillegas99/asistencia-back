// src/modules/skool/course/dto/create-course.dto.ts
import { IsOptional, IsString, IsIn, IsBoolean, IsNumber } from 'class-validator';

export class CreateCourseDto {
  @IsString() title: string;
  @IsString() communityId: string;

  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() description?: string;

  @IsOptional() @IsIn(['private','public']) visibility?: 'private'|'public';
  @IsOptional() @IsIn(['draft','published']) status?: 'draft'|'published';
  @IsOptional() @IsNumber() sortIndex?: number;

  // Opción A: ya la tienes
  @IsOptional() @IsString() coverMediaId?: string;

  // Opción B: todo-en-uno (base64)
  @IsOptional() @IsString() coverImageBase64?: string;    // dataURL o base64 puro
  @IsOptional() @IsString() coverImageContentType?: string; // ej "image/png"
}

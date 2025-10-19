// src/modules/skool/quiz/dto/create-quiz.dto.ts
import { IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateQuizDto {
  @IsMongoId() lessonId: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) passMark?: number;   // % aprobación
  @IsOptional() @IsNumber() @Min(0) maxAttempts?: number;           // 0 = ilimitado
  @IsOptional() @IsEnum(['draft','published'] as any) status?: 'draft'|'published';
  @IsOptional() categories?: string[];
}

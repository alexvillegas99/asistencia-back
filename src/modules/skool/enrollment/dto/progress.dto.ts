// src/modules/skool/enrollment/dto/progress.dto.ts
import { IsArray, IsMongoId, IsNumber, Max, Min } from 'class-validator';

export class ProgressDto {
  @IsArray()
  updates: Array<{
    lessonId: string;
    progress: number; // 0..100
  }>;
}

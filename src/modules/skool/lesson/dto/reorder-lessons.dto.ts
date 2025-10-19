// src/modules/skool/lesson/dto/reorder-lessons.dto.ts
import { IsArray, IsMongoId } from 'class-validator';

export class ReorderLessonsDto {
  @IsArray()
  @IsMongoId({ each: true })
  lessonIdsInOrder: string[]; // nuevo orden (primer elemento = sortIndex 0)
}

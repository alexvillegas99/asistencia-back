// src/modules/skool/quiz/dto/submit-answers.dto.ts
import { IsArray, IsMongoId, IsOptional, IsString } from 'class-validator';

export class SubmitAnswersDto {
  @IsArray()
  answers: Array<{
    questionId: string;
    answerIndexes?: number[]; // single/multiple/boolean
    answerText?: string;      // shorttext
  }>;

  // identificador del alumno que responde (interno o externo)
  @IsOptional() @IsMongoId()
  userId?: string;

  @IsOptional() @IsMongoId()
  externalUserId?: string;
}

// src/modules/skool/quiz/dto/add-question.dto.ts
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class AddQuestionDto {
  @IsString() @MaxLength(1000) text: string;
  @IsEnum(['single', 'multiple', 'boolean', 'shorttext'] as any) type:
    | 'single'
    | 'multiple'
    | 'boolean'
    | 'shorttext';

  @IsOptional() @IsArray() options?: string[]; // para single/multiple
  @IsOptional() @IsArray() correctIndexes?: number[]; // para single/multiple/boolean
  @IsOptional() @IsArray() acceptableAnswers?: string[]; // para shorttext

  @IsOptional() @IsNumber() @Min(0) points?: number;
  @IsOptional() @IsNumber() sortIndex?: number;
  @IsOptional() @IsString() category?: string;
  @IsOptional()
  @IsEnum(['plain', 'markdown+latex'] as any)
  renderMode?: 'plain' | 'markdown+latex';
}

// src/modules/skool/quiz/schemas/question.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SkoolQuestionDocument = HydratedDocument<SkoolQuestion>;
type QType = 'single' | 'multiple' | 'boolean' | 'shorttext';

@Schema({ collection: 'skool_questions', timestamps: true })
export class SkoolQuestion {
  @Prop({ type: Types.ObjectId, ref: 'SkoolQuiz', required: true, index: true })
  quizId: Types.ObjectId;

  @Prop({ required: true }) text: string;

  @Prop({ enum: ['single','multiple','boolean','shorttext'], default: 'single' })
  type: QType;

  // para single/multiple: opciones y correctas
  @Prop({ type: [String], default: [] })
  options: string[];

  @Prop({ type: [Number], default: [] })
  correctIndexes: number[]; // índices de options correctas

  // para boolean: true/false (usa options = ['false','true'] y correctIndexes = [1] por ejemplo)
  // para shorttext: valida por coincidencia simple (normalizada)
  @Prop({ type: [String], default: [] })
  acceptableAnswers: string[];

  @Prop({ default: 1 }) points: number;

  @Prop({ default: 0 }) sortIndex: number;

  @Prop({ default: '' }) category?: string;

  @Prop({ enum: ['plain','markdown+latex'], default: 'plain' })
renderMode: 'plain' | 'markdown+latex';
}

export const SkoolQuestionSchema = SchemaFactory.createForClass(SkoolQuestion);
SkoolQuestionSchema.index({ quizId: 1, sortIndex: 1 });

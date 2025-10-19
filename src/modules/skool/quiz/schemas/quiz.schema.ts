// src/modules/skool/quiz/schemas/quiz.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SkoolQuizDocument = HydratedDocument<SkoolQuiz>;

@Schema({ collection: 'skool_quizzes', timestamps: true })
export class SkoolQuiz {
  @Prop({ type: Types.ObjectId, ref: 'Lesson', required: true, unique: true, index: true })
  lessonId: Types.ObjectId;          // <- 1 quiz por lección

  @Prop({ default: 'Cuestionario' })
  title: string;

  @Prop({ default: 70 })             // 0..100
  passMark: number;

  @Prop({ default: 1 })              // 0 = ilimitado
  maxAttempts: number;

  @Prop({ enum: ['draft', 'published'], default: 'draft' })
  status: 'draft' | 'published';

  @Prop({ type: [String], default: [] })
  categories: string[];              // opcional, para clasificar preguntas
}

export const SkoolQuizSchema = SchemaFactory.createForClass(SkoolQuiz);
SkoolQuizSchema.index({ lessonId: 1 }, { unique: true });

// src/modules/skool/quiz/schemas/attempt.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SkoolAttemptDocument = HydratedDocument<SkoolAttempt>;

@Schema({ collection: 'skool_attempts', timestamps: true })
export class SkoolAttempt {
  @Prop({ type: Types.ObjectId, ref: 'SkoolQuiz', required: true, index: true })
  quizId: Types.ObjectId;

  // autor del intento (interno o externo)
  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ExternalUser' })
  externalUserId?: Types.ObjectId;

  // respuestas dadas
  @Prop({
    type: [{
      questionId: { type: Types.ObjectId, ref: 'SkoolQuestion' },
      answerIndexes: { type: [Number], default: [] }, // single/multiple/boolean
      answerText: { type: String, default: '' },      // shorttext
      isCorrect: { type: Boolean, default: false },
      score: { type: Number, default: 0 }
    }],
    default: [],
  })
  answers: Array<{
    questionId: Types.ObjectId;
    answerIndexes?: number[];
    answerText?: string;
    isCorrect: boolean;
    score: number;
  }>;

  @Prop({ default: 0 }) totalScore: number;
  @Prop({ default: 0 }) maxScore: number;

  @Prop({ enum: ['in_progress','submitted'], default: 'in_progress' })
  status: 'in_progress' | 'submitted';

  @Prop({ default: false }) passed: boolean;
  @Prop({ type: Date }) submittedAt?: Date;
}

export const SkoolAttemptSchema = SchemaFactory.createForClass(SkoolAttempt);
SkoolAttemptSchema.index({ quizId: 1, userId: 1, externalUserId: 1, createdAt: -1 });

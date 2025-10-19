// src/modules/skool/metrics/schemas/metrics.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
export type SkoolMetricEventDocument = HydratedDocument<SkoolMetricEvent>;
type MetricType = 'lesson_view'|'quiz_started'|'quiz_passed'|'course_completed'|'post_created'|'comment_created';

@Schema({ collection: 'skool_metric_events', timestamps: true })
export class SkoolMetricEvent {
  @Prop({ type: Types.ObjectId, required: true, index: true }) communityId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'SkoolCourse' }) courseId?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Lesson' }) lessonId?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'SkoolQuiz' }) quizId?: Types.ObjectId;
  @Prop({ enum: ['lesson_view','quiz_started','quiz_passed','course_completed','post_created','comment_created'], required: true })
  type: MetricType;
  @Prop({ type: Types.ObjectId, ref: 'User' }) userId?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'ExternalUser' }) externalUserId?: Types.ObjectId;
  @Prop({ type: Object, default: {} }) meta?: Record<string, any>;
}
export const SkoolMetricEventSchema = SchemaFactory.createForClass(SkoolMetricEvent);
SkoolMetricEventSchema.index({ communityId: 1, type: 1, createdAt: -1 });

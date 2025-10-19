// src/modules/skool/lesson/schemas/lesson.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SkoolLessonDocument = HydratedDocument<SkoolLesson>;

@Schema({ collection: 'skool_lessons', timestamps: true })
export class SkoolLesson {
  @Prop({ type: Types.ObjectId, ref: 'SkoolCourse', required: true, index: true })
  courseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'SkoolSection', required: true, index: true })
  sectionId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ default: '' })
  content?: string;

  @Prop({ type: Types.ObjectId, ref: 'Media' })
  videoMediaId?: Types.ObjectId;

  @Prop({ default: '' })
  videoKey?: string;

  @Prop({ type: [Types.ObjectId], ref: 'Media', default: [] })
  attachments?: Types.ObjectId[];

  @Prop({ default: 0 })
  durationSec?: number;

  @Prop({ default: 0 })
  sortIndex: number;

  @Prop({ enum: ['draft', 'published', 'archived'], default: 'draft' })
  status: 'draft' | 'published' | 'archived';

  @Prop({ default: false })
  isPreview?: boolean;
}
export const SkoolLessonSchema = SchemaFactory.createForClass(SkoolLesson);
SkoolLessonSchema.index({ courseId: 1, sectionId: 1, sortIndex: 1 }, { unique: true });

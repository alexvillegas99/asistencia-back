// src/modules/skool/section/schemas/section.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SkoolSectionDocument = HydratedDocument<SkoolSection>;

@Schema({ collection: 'skool_sections', timestamps: true })
export class SkoolSection {
  @Prop({ type: Types.ObjectId, ref: 'SkoolCourse', required: true, index: true })
  courseId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true, default: '' })
  summary?: string;

  @Prop({ type: Number, default: 0, index: true })
  sortIndex: number;

  @Prop({ enum: ['draft', 'published', 'archived'], default: 'draft' })
  status: 'draft' | 'published' | 'archived';
}
export const SkoolSectionSchema = SchemaFactory.createForClass(SkoolSection);
SkoolSectionSchema.index({ courseId: 1, sortIndex: 1 }, { unique: true });

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SkoolCourseDocument = HydratedDocument<SkoolCourse>;

@Schema({ collection: 'skool_courses', timestamps: true })
export class SkoolCourse {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  communityId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, lowercase: true, trim: true, index: true, unique: true })
  slug: string;

  @Prop({ trim: true }) category?: string;
  @Prop({ default: '' }) description?: string;

  @Prop({ type: Types.ObjectId, ref: 'Media' }) coverMediaId?: Types.ObjectId;

  @Prop({ enum: ['public','private'], default: 'private' }) visibility: 'public'|'private';
  @Prop({ enum: ['draft','published','archived'], default: 'draft' }) status: 'draft'|'published'|'archived';
  @Prop({ default: 0 }) sortIndex: number;
}

export const SkoolCourseSchema = SchemaFactory.createForClass(SkoolCourse);
SkoolCourseSchema.index({ communityId: 1, slug: 1 }, { unique: false });

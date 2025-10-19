// src/modules/skool/moderation/schemas/moderation.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
export type SkoolReportDocument = HydratedDocument<SkoolReport>;
type TargetType = 'post'|'comment'|'lesson'|'course';
type Status = 'open'|'reviewing'|'resolved'|'rejected';

@Schema({ collection: 'skool_reports', timestamps: true })
export class SkoolReport {
  @Prop({ type: Types.ObjectId, required: true, index: true }) communityId: Types.ObjectId;
  @Prop({ enum: ['post','comment','lesson','course'], required: true }) targetType: TargetType;
  @Prop({ type: Types.ObjectId, required: true, index: true }) targetId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' }) reporterId?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'ExternalUser' }) externalReporterId?: Types.ObjectId;

  @Prop({ required: true }) reason: string;
  @Prop({ enum: ['open','reviewing','resolved','rejected'], default: 'open', index: true }) status: Status;

  @Prop({ type: Types.ObjectId, ref: 'User' }) reviewedById?: Types.ObjectId;
  @Prop({ default: '' }) resolutionNote?: string;
}
export const SkoolReportSchema = SchemaFactory.createForClass(SkoolReport);
SkoolReportSchema.index({ communityId: 1, targetType: 1, targetId: 1, status: 1 });

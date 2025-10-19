// src/modules/skool/event/schemas/event.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, HydratedDocument } from 'mongoose';
export type SkoolEventDocument = HydratedDocument<SkoolEvent>;

@Schema({ collection: 'skool_events', timestamps: true })
export class SkoolEvent {
  @Prop({ type: Types.ObjectId, required: true, index: true }) communityId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'SkoolCourse' }) courseId?: Types.ObjectId; // opcional, evento de un curso
  @Prop({ required: true, trim: true }) title: string;
  @Prop({ default: '' }) description?: string;
  @Prop({ type: Date, required: true }) startsAt: Date;
  @Prop({ type: Date, required: true }) endsAt: Date;
  @Prop({ default: 'online' }) locationType: 'online'|'onsite';
  @Prop({ default: '' }) location?: string; // URL o dirección
  @Prop({ default: false }) allDay?: boolean;
  @Prop({ type: [Types.ObjectId], ref: 'Media', default: [] }) attachments: Types.ObjectId[];
  @Prop({ enum: ['draft','published','cancelled'], default: 'published', index: true }) status: 'draft'|'published'|'cancelled';
}
export const SkoolEventSchema = SchemaFactory.createForClass(SkoolEvent);
SkoolEventSchema.index({ communityId: 1, startsAt: 1 });

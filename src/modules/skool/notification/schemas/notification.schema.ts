// src/modules/skool/notification/schemas/notification.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
export type SkoolNotificationDocument = HydratedDocument<SkoolNotification>;
type Kind = 'post'|'comment'|'lesson'|'quiz'|'event'|'system';

@Schema({ collection: 'skool_notifications', timestamps: true })
export class SkoolNotification {
  @Prop({ type: Types.ObjectId, required: true, index: true }) communityId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', index: true }) userId?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'ExternalUser', index: true }) externalUserId?: Types.ObjectId;

  @Prop({ enum: ['post','comment','lesson','quiz','event','system'], default: 'system' })
  kind: Kind;

  @Prop({ required: true }) title: string;
  @Prop({ default: '' }) body: string;

  @Prop({ default: '' }) actionUrl?: string; // link a front
  @Prop({ default: false, index: true }) read: boolean;

  @Prop({ type: Object, default: {} }) meta?: Record<string, any>;
}
export const SkoolNotificationSchema = SchemaFactory.createForClass(SkoolNotification);
SkoolNotificationSchema.index({ communityId: 1, userId: 1, externalUserId: 1, createdAt: -1 });

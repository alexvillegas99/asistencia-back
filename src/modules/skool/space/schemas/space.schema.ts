// src/modules/skool/space/schemas/space.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
export type SkoolSpaceDocument = HydratedDocument<SkoolSpace>;
@Schema({ collection: 'skool_spaces', timestamps: true })
export class SkoolSpace {
  @Prop({ type: Types.ObjectId, required: true, index: true }) communityId: Types.ObjectId;
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ required: true, lowercase: true, trim: true, index: true }) slug: string;
  @Prop({ default: '' }) description?: string;
  @Prop({ default: 0 }) sortIndex: number;
  @Prop({ enum: ['active','archived'], default: 'active', index: true }) status: 'active'|'archived';
  @Prop({ type: Object, default: {} }) settings?: Record<string, any>;
}
export const SkoolSpaceSchema = SchemaFactory.createForClass(SkoolSpace);
SkoolSpaceSchema.index({ communityId: 1, slug: 1 }, { unique: true });

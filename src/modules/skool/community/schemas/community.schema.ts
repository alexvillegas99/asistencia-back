// src/modules/skool/community/schemas/community.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SkoolCommunityDocument = HydratedDocument<SkoolCommunity>;

@Schema({ collection: 'skool_communities', timestamps: true })
export class SkoolCommunity {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, lowercase: true, trim: true, unique: true, index: true })
  slug: string;

  @Prop({ default: '' })
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'Media' })
  avatarMediaId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Media' })
  bannerMediaId?: Types.ObjectId;

  @Prop({ enum: ['public','private'], default: 'private' })
  visibility: 'public' | 'private';

  @Prop({ enum: ['active','archived'], default: 'active', index: true })
  status: 'active' | 'archived';

  // dueño (usuario interno)
  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true })
  ownerId: Types.ObjectId;

  // settings opcionales
  @Prop({ type: Object, default: {} })
  settings?: Record<string, any>;
}

export const SkoolCommunitySchema = SchemaFactory.createForClass(SkoolCommunity);
SkoolCommunitySchema.index({ slug: 1 }, { unique: true });

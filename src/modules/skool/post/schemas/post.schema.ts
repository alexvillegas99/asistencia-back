// src/modules/skool/post/schemas/post.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SkoolPostDocument = HydratedDocument<SkoolPost>;

@Schema({ collection: 'skool_posts', timestamps: true })
export class SkoolPost {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  communityId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: false, index: true })
  spaceId?: Types.ObjectId; // opcional si usas “spaces”

  @Prop({ type: Types.ObjectId, required: false, ref: 'User', index: true })
  authorId?: Types.ObjectId; // usuario interno

  @Prop({ type: Types.ObjectId, required: false, ref: 'ExternalUser', index: true })
  externalAuthorId?: Types.ObjectId; // usuario externo

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ default: '' })
  body: string; // markdown/HTML simple

  @Prop({ type: [Types.ObjectId], ref: 'Media', default: [] })
  attachments: Types.ObjectId[];

  @Prop({ default: false })
  pinned: boolean;

  @Prop({ type: Object, default: {} })
  reactions: Record<string, number>; // {'👍': 3, '❤️': 2}
}

export const SkoolPostSchema = SchemaFactory.createForClass(SkoolPost);
SkoolPostSchema.index({ communityId: 1, spaceId: 1, createdAt: -1 });

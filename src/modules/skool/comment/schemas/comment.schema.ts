// src/modules/skool/comment/schemas/comment.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
export type SkoolCommentDocument = HydratedDocument<SkoolComment>;

@Schema({ collection: 'skool_comments', timestamps: true })
export class SkoolComment {
  @Prop({ type: Types.ObjectId, ref: 'SkoolPost', required: true, index: true })
  postId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  communityId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true }) authorId?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'ExternalUser', index: true }) externalAuthorId?: Types.ObjectId;

  @Prop({ required: true, default: '' }) body: string;
  @Prop({ type: [Types.ObjectId], ref: 'Media', default: [] }) attachments: Types.ObjectId[];
}
export const SkoolCommentSchema = SchemaFactory.createForClass(SkoolComment);
SkoolCommentSchema.index({ postId: 1, createdAt: 1 });

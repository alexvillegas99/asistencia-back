// src/modules/media/schemas/media.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MediaDocument = HydratedDocument<Media>;

@Schema({ timestamps: true })
export class Media {
  _id: any;

  @Prop({ required: true, enum: ['image', 'video', 'file'] })
  kind: 'image' | 'video' | 'file';

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true, default: 0 })
  size: number;

  @Prop({ required: true })
  s3Key: string;

  @Prop() url?: string; // pública (S3/CloudFront)
  @Prop({ default: 'pending', enum: ['pending', 'processing', 'ready', 'failed'] })
  status: 'pending' | 'processing' | 'ready' | 'failed';

  // extras útiles
  @Prop() checksum?: string; // sha256
  @Prop() width?: number;
  @Prop() height?: number;
  @Prop() durationSec?: number;
  @Prop({ type: Object, default: [] })
  variants?: Array<{
    type: 'image' | 'video';
    s3Key: string;
    url?: string;
    width?: number;
    height?: number;
    bitrateKbps?: number;
    format?: 'jpg' | 'webp' | 'hls' | 'mp4';
  }>;

  @Prop() originalName?: string;
  @Prop() communityId?: string;
  @Prop() ownerId?: string;
}

export const MediaSchema = SchemaFactory.createForClass(Media);

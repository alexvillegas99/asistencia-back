// src/modules/skool/external-user/schemas/external-user.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ExternalUserDocument = HydratedDocument<ExternalUser>;

@Schema({ collection: 'external_users', timestamps: true })
export class ExternalUser {
  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  // Si manejas login propio para externos
  @Prop({ required: false, select: false })
  passwordHash?: string;

  @Prop({ enum: ['invited', 'active', 'blocked'], default: 'invited' })
  status: 'invited' | 'active' | 'blocked';

  @Prop({ required: false, trim: true })
  phone?: string;

  @Prop({ type: Object, required: false })
  metadata?: Record<string, any>;
}

export const ExternalUserSchema = SchemaFactory.createForClass(ExternalUser);

// Índices sugeridos
ExternalUserSchema.index({ email: 1 }, { unique: true });
ExternalUserSchema.index({ status: 1 });

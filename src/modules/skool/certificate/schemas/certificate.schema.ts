// src/modules/skool/certificate/schemas/certificate.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SkoolCertificateDocument = HydratedDocument<SkoolCertificate>;

@Schema({ collection: 'skool_certificates', timestamps: true })
export class SkoolCertificate {
  @Prop({ type: Types.ObjectId, ref: 'SkoolCommunity', required: true, index: true })
  communityId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'SkoolCourse', required: true, index: true })
  courseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Enrollment', required: true, index: true })
  enrollmentId: Types.ObjectId;

  // quién recibe (interno o externo)
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  userId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ExternalUser', index: true })
  externalUserId?: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  code: string; // código único (para verificación pública)

  @Prop({ type: Date, required: true })
  issuedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'Media' })
  pdfMediaId?: Types.ObjectId;

  @Prop({ default: '' })
  pdfKey?: string; // key de S3 por si no usas media

  @Prop({ default: '' })
  verifyUrl?: string;

  @Prop({ enum: ['issued','revoked'], default: 'issued', index: true })
  status: 'issued' | 'revoked';

  // datos “estáticos” al momento de emitir (por si el curso/candidato cambian)
  @Prop({ type: Object, default: {} })
  snapshot: {
    studentName?: string;
    courseTitle?: string;
    communityName?: string;
    scorePercent?: number;
  };
}

export const SkoolCertificateSchema = SchemaFactory.createForClass(SkoolCertificate);
SkoolCertificateSchema.index({ courseId: 1, userId: 1 }, { partialFilterExpression: { userId: { $exists: true } } });
SkoolCertificateSchema.index({ courseId: 1, externalUserId: 1 }, { partialFilterExpression: { externalUserId: { $exists: true } } });

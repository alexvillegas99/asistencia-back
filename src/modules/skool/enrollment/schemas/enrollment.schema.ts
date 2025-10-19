// src/modules/skool/enrollment/schemas/enrollment.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EnrollmentDocument = HydratedDocument<Enrollment>;

@Schema({ collection: 'enrollments', timestamps: true })
export class Enrollment {
@Prop({ type: Types.ObjectId, ref: 'SkoolCourse', required: true, index: true })
courseId: Types.ObjectId;

  // uno de los dos: userId (usuario interno) o externalUserId (usuario externo)
  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true })
  userId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ExternalUser', required: false, index: true })
  externalUserId?: Types.ObjectId;

  @Prop({ enum: ['active','completed','cancelled'], default: 'active', index: true })
  status: 'active' | 'completed' | 'cancelled';

  // progreso ligero
  @Prop({
    type: [{
      lessonId: { type: Types.ObjectId, ref: 'Lesson' },
      progress: { type: Number, min: 0, max: 100 }, // %
      completedAt: { type: Date, required: false }
    }],
    default: []
  })
  lessonsProgress: Array<{ lessonId: Types.ObjectId; progress: number; completedAt?: Date }>;

  @Prop({ type: Date })
  startedAt?: Date;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ type: Object, default: {} })
  meta?: Record<string, any>;
}

export const EnrollmentSchema = SchemaFactory.createForClass(Enrollment);

// Unicidad: un usuario (interno o externo) no debe tener 2 matrículas activas al mismo curso
EnrollmentSchema.index({ courseId: 1, userId: 1 }, { unique: true, partialFilterExpression: { userId: { $exists: true } } });
EnrollmentSchema.index({ courseId: 1, externalUserId: 1 }, { unique: true, partialFilterExpression: { externalUserId: { $exists: true } } });

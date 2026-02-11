import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Evaluacion extends Document {

  @Prop({ required: true })
  nombre: string;

  @Prop({ required: true })
  fechaInicio: Date;

  @Prop({ required: true })
  fechaFin: Date;

  @Prop()
  observacion: string;

  @Prop({ default: true })
  activa: boolean;
}

export const EvaluacionSchema = SchemaFactory.createForClass(Evaluacion);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CampañaDocument = Campaña & Document;

@Schema({ timestamps: true })
export class Campaña {
  @Prop({ required: true })
  imagen: string;

  @Prop({ required: false })
  link?: string;

  @Prop({ required: true })
  fechaInicio: Date;

  @Prop({ required: true })
  fechaFin: Date;

  @Prop({ required: true, default: true })
  estado: boolean;
}

export const CampañaSchema = SchemaFactory.createForClass(Campaña);

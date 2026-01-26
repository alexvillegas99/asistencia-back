import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Rating extends Document {
  @Prop({ required: true })
  usuario: string;

  @Prop({ required: true, min: 1, max: 5 })
  calificacion: number;

  @Prop()
  observacion?: string;
}

export const RatingSchema = SchemaFactory.createForClass(Rating);

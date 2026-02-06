import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type CursoDocument = HydratedDocument<Curso>;

@Schema({ timestamps: true })
export class Curso {
  @Prop({ type: String, required: true })
  nombre: string;

  @Prop({
    type: String,
    required: true,
    enum: ['Activo', 'Inactivo'],
    default: 'Activo',
  })
  estado: string;

  @Prop({ type: String, required: false }) // URL de la imagen o base64 opcional
  imagen: string;

  @Prop({ type: Number, required: true, default: 24 })
  diasCurso: number;

  @Prop({ type: Number, required: true, default: 0 })
  diasActuales: number;

  @Prop({ type: String, required: false })
  categoria?: string;

  @Prop({ type: [Object], default: [] })
  horario?: Record<string, any>[]; 

  @Prop({ type: String, required: false })
  periodo?: string;
}

export const CursoSchema = SchemaFactory.createForClass(Curso);

export const CursoModelName = 'Curso';

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

  @Prop({ type: Number, required: true, default: 0 })
  diasCurso: number;

  @Prop({ type: Number, required: true, default: 0 })
  diasActuales: number;

  
}

export const CursoSchema = SchemaFactory.createForClass(Curso);

export const CursoModelName = 'cursos';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import mongoose from 'mongoose';
import { Usuario } from 'src/usuarios/entities/usuario.entity';

export type CodigoProfesoresDocument = HydratedDocument<CodigoProfesores>;

@Schema({ timestamps: true })
export class CodigoProfesores {
  @Prop({ required: true, unique: true })
  codigo: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true })
  profesor: Usuario;

  @Prop({ type: Date, required: true })
  expiracion: Date;
}

export const CodigoProfesoresSchema = SchemaFactory.createForClass(CodigoProfesores);

export const CodigoProfesoresModelName = 'codigo_profesores';

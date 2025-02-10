import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type UsuarioDocument = HydratedDocument<Usuario>;

export enum RolUsuario {
  ADMIN = 'ADMIN',
  PROFESOR = 'PROFESOR',
  ESTUDIANTE = 'ASESOR',
}

@Schema({ timestamps: true })
export class Usuario {
  @Prop({ type: String, required: true })
  nombre: string;

  @Prop({ type: String, required: true, unique: true }) // Correo único
  email: string;

  @Prop({ type: String, required: true })
  password: string;

  @Prop({ type: String, required: true, enum: Object.values(RolUsuario) })
  rol: RolUsuario;
}

export const UsuarioSchema = SchemaFactory.createForClass(Usuario);

export const UsuarioModelName = 'usuarios';

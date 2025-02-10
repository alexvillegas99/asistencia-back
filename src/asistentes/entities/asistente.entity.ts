import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';


export type AsistentesDocument = HydratedDocument<Asistentes>;

@Schema({ timestamps: true })
export class Asistentes {
  @Prop({ type: String, required: true })
  cedula: string;

  @Prop({ type: String, required: true })
  nombre: string;

  @Prop({ type: String, required: false })
  qr: string;

  @Prop({ type: String, required: false })
  negocio: string;

  @Prop({ type: Date, required: true, default: Date.now }) // Fecha UTC
  createdAt: Date;

  @Prop({ type: Date, required: true ,default:Date.now}) // Fecha ajustada a Ecuador (UTC-5)
  createdAtEcuador: Date;

  @Prop({ type: String, ref: 'Curso', required: true }) // Relación con Curso
  curso: string;


  @Prop({ type: Boolean, required: false, default: true }) // Estado activo/inactivo
  estado: boolean;

}

export const AsistentesSchema = SchemaFactory.createForClass(Asistentes);

// Middleware para ajustar la fecha a UTC-5
AsistentesSchema.pre('save', function (next) {
  const currentDate = new Date();
  this.createdAtEcuador = new Date(currentDate.getTime() - 5 * 60 * 60 * 1000); // Ajustar a UTC-5
  next();
});

export const AsistentesModelName = 'asistentes';

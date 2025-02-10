import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type AsistenciaDocument = HydratedDocument<Asistencia>;

@Schema({ timestamps: true })
export class Asistencia {
  @Prop({ type: String, required: true })
  cedula: string;

  @Prop({
    type: String,
    set: (val: Date) => {
      const date = new Date(val);
      return date.toISOString().split('T')[0]; // Solo la fecha
    },
  })
  fecha: string;

  @Prop({
    type: String,
    required: true,
    default: () => {
      const now = new Date();
      return `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`; // Hora en formato HH:mm:ss
    },
  })
  hora: string;

  @Prop({ type: String, required: true }) // Referencia al ID del asistente
  asistenteId: string;

  @Prop({ type: String, required: true }) // Relación con Curso
  curso: string;

  @Prop({ type: Date, default: () => new Date(Date.now() - 5 * 60 * 60 * 1000) }) // Fecha en Ecuador (UTC-5)
  fechaEcuador: Date;
}

export const AsistenciaSchema = SchemaFactory.createForClass(Asistencia);

export const AsistenciaModelName = 'asistencia';

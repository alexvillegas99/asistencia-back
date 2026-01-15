// asistentes.schema.ts
import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type AsistentesDocument = HydratedDocument<Asistentes>;

const ETAPA_ACTUAL = [
  'SIN_CITA',
  'PRIMERA',
  'SEGUNDA',
  'TERCERA',
  'CUARTA',
] as const;
const ESTADO_CITA = [
  'EN_PROCESO',
  'COMPLETA',
  'NO_ASISTE',
  'REAGENDAMIENTO',
] as const;

// -------- Subschemas (sin _id) --------
@Schema({ _id: false })
class CitaLogSub {
  @Prop({ type: String, enum: ESTADO_CITA, required: true })
  estado: (typeof ESTADO_CITA)[number];

  @Prop({ type: String, required: true }) // ISO: 2025-08-23T15:00
  fechaISO: string;

  @Prop({ type: String, required: true })
  comentario: string;

  @Prop({ type: String, required: true }) // timestamp de registro del log
  tsISO: string;
}
const CitaLogSchema = SchemaFactory.createForClass(CitaLogSub);

@Schema({ _id: false })
class CitaEtapaSub {
  @Prop({ type: String, enum: ESTADO_CITA, required: false })
  estado?: (typeof ESTADO_CITA)[number];

  @Prop({ type: String, required: false })
  fechaISO?: string;

  @Prop({ type: String, required: false })
  comentario?: string;

  @Prop({ type: [CitaLogSchema], default: [] })
  logs: CitaLogSub[];
}
const CitaEtapaSchema = SchemaFactory.createForClass(CitaEtapaSub);

function ovDefault() {
  return {
    etapaActual: 'SIN_CITA',
    etapas: {
      primera: { logs: [] },
      segunda: { logs: [] },
      tercera: { logs: [] },
      cuarta: { logs: [] },
    },
  };
}

@Schema({ _id: false })
class OrientacionVocacionalSub {
  @Prop({ type: String, enum: ETAPA_ACTUAL, default: 'SIN_CITA' })
  etapaActual: (typeof ETAPA_ACTUAL)[number];

  // definimos cada etapa con su default de logs vacío
  @Prop({ type: CitaEtapaSchema, default: () => ({ logs: [] }) })
  primera: CitaEtapaSub;

  @Prop({ type: CitaEtapaSchema, default: () => ({ logs: [] }) })
  segunda: CitaEtapaSub;

  @Prop({ type: CitaEtapaSchema, default: () => ({ logs: [] }) })
  tercera: CitaEtapaSub;

  @Prop({ type: CitaEtapaSchema, default: () => ({ logs: [] }) })
  cuarta: CitaEtapaSub;

  @Prop({ type: String, required: false, default: null })
  siguienteCitaISO?: string;
}
const OrientacionVocacionalSchema = SchemaFactory.createForClass(
  OrientacionVocacionalSub,
);

// -------- Tu esquema principal --------
@Schema({ timestamps: true })
export class Asistentes {
  @Prop({ type: String, required: true }) cedula: string;
  @Prop({ type: String, required: true }) nombre: string;
  @Prop({ type: String }) qr?: string;
  @Prop({ type: String }) negocio?: string;
  // ✅ NUEVOS CAMPOS OPCIONALES
  @Prop({ type: String, required: false, trim: true })
  telefono?: string;

  @Prop({ type: String, required: false, trim: true })
  correo?: string;

  @Prop({ type: Date, default: Date.now }) createdAt: Date;
  @Prop({ type: Date, default: Date.now }) createdAtEcuador: Date;
  @Prop({ type: String, ref: 'Curso', required: true }) curso: string;
  @Prop({ type: [{ type: String, ref: 'Curso' }], default: [] })
  cursos: string[];
  @Prop({ type: Boolean, default: true }) estado: boolean;
  @Prop({ type: Number, default: 0 }) asistencias: number;
  @Prop({ type: Number, default: 0 }) inasistencias: number;
  @Prop({ type: Number, default: 0 }) asistenciasInactivas: number;
  @Prop({ type: Number, default: 0 }) asistenciasAdicionales: number;

  // ✅ NUEVO CAMPO con default para nuevos documentos
  @Prop({
    // puedes modelarlo como objeto plano…
    // type: Object, default: ovDefault
    // …o mejor con sub-schema tipado:
    type: OrientacionVocacionalSchema,
    default: () => ({
      etapaActual: 'SIN_CITA',
      primera: { logs: [] },
      segunda: { logs: [] },
      tercera: { logs: [] },
      cuarta: { logs: [] },
    }),
  })
  orientacionVocacional?: OrientacionVocacionalSub;
}
export const AsistentesSchema = SchemaFactory.createForClass(Asistentes);

// Mantienes tu pre('save') si lo necesitas
AsistentesSchema.pre('save', function (next) {
  const currentDate = new Date();
  // @ts-ignore
  this.createdAtEcuador = new Date(currentDate.getTime() - 5 * 60 * 60 * 1000);
  next();
});

export const AsistentesModelName = 'asistentes';

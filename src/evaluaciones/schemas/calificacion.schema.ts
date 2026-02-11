import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class CalificacionProfesor extends Document {
  @Prop({ required: true })
  estudianteNombre: string;

  @Prop({ required: true })
  estudianteCedula: string;

  @Prop({ required: true, min: 1, max: 5 })
  calificacion: number;

  @Prop()
  observacion: string;

  @Prop({ required: true })
  profesorNombre: string;

  @Prop({ type: Types.ObjectId, ref: 'Evaluacion', required: true })
  evaluacionId: Types.ObjectId;

  @Prop({ required: true })
  cursoId: string;

    @Prop({ required: true })
  cursoNombre : string;

  @Prop({ default: Date.now })
  fecha: Date;
}

export const CalificacionProfesorSchema =
  SchemaFactory.createForClass(CalificacionProfesor);

CalificacionProfesorSchema.index(
  {
    evaluacionId: 1,
    profesorNombre: 1,
    cursoId: 1,
    estudianteCedula: 1,
  },
  { unique: true },
);

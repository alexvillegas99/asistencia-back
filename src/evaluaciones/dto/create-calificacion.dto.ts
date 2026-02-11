export class CreateCalificacionDto {
  estudianteNombre: string;
  estudianteCedula: string;
  calificacion: number;
  observacion?: string;
  profesorNombre: string;
  evaluacionId: string;
  cursoId: string;
  fecha?: Date;
}

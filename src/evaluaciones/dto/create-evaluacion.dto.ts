export class CreateEvaluacionDto {
  nombre: string;
  fechaInicio: Date;
  fechaFin: Date;
  observacion?: string;
  activa?: boolean;
}

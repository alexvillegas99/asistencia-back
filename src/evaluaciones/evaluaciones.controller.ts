import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { EvaluacionesService } from './evaluaciones.service';

@Controller('evaluaciones')
export class EvaluacionesController {
  constructor(private readonly service: EvaluacionesService) {}

  // ===== EVALUACIONES =====

  @Post()
  crearEvaluacion(@Body() body: any) {
    return this.service.crearEvaluacion(body);
  }

  @Get()
  obtenerEvaluaciones() {
    return this.service.obtenerEvaluaciones();
  }

  @Patch(':id')
  actualizarEvaluacion(@Param('id') id: string, @Body() body: any) {
    return this.service.actualizarEvaluacion(id, body);
  }

  // ===== CALIFICACIONES =====

  @Post('calificaciones')
  crearCalificacion(@Body() body: any) {
    return this.service.crearCalificacion(body);
  }

  @Get('calificaciones')
  obtenerCalificaciones(@Query() query: any) {
    return this.service.obtenerCalificaciones(query);
  }

  @Get('activas/hoy')
  obtenerEvaluacionesActivasHoy() {
    return this.service.obtenerEvaluacionesActivasHoy();
  }

  @Get('estado-estudiante')
obtenerEstadoEvaluaciones(
  @Query('evaluacionId') evaluacionId: string,
  @Query('cedula') cedula: string,
) {
  return this.service.obtenerEstadoEvaluacionesPorEstudiante(
    evaluacionId,
    cedula,
  );
}

}

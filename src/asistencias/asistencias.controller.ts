import {
  Controller,
  Get,
  Post,
  Body,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Query,
} from '@nestjs/common';
import { AsistenciasService } from './asistencias.service';
import { CreateAsistenciaDto } from './dto/create-asistencia.dto';
import { ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('Asistencias')
@Controller('asistencias')
export class AsistenciasController {
  constructor(private readonly asistenciasService: AsistenciasService) {}

  @Post()
  create(@Body() createAsistenciaDto: CreateAsistenciaDto) {
    return this.asistenciasService.create(createAsistenciaDto);
  }

  @Get()
  @ApiQuery({
    name: 'idCurso',
    required: true,
    description: 'El ID del curso para generar el reporte de asistencias',
    example: '64234c3bdcfa0f3f34097e78',
  })
  async findAll(@Query('idCurso') idCurso: string) {
    return this.asistenciasService.generateAsistenciaReportDebug(idCurso);
  }

  


  @Post('registrar')
  async registrarAsistencia(@Body() data: any) {
    try {
      console.log('Registrar asistencia');
      console.log(data);
      // Validar si el curso está activo
      const cursoActivo = await this.asistenciasService.verificarCursoActivo(
        data.cursoId,
      );
      if (!cursoActivo) {
        throw new BadRequestException('El curso no está activo.');
      }

      // Validar si el asistente pertenece al curso
      const perteneceAlCurso:any =
        await this.asistenciasService.validarAsistenteEnCurso(
          data.cedula
        );
        console.log(perteneceAlCurso)



      if (!perteneceAlCurso.valid) {
        throw new NotFoundException(
          'El asistente no pertenece al curso especificado.',
        );
      }

      // Registrar asistencia si no existe en el día actual
      const asistenciaRegistrada =
        await this.asistenciasService.registrarAsistencia(
          data.cedula,
          data.cursoId,
        ); 
      if (asistenciaRegistrada === 'completo') {
        throw new ConflictException(
          'El asistente ya tiene registrada la asistencia para hoy.',
        );
      } else if (asistenciaRegistrada === 'espere') {
        //Mensaje indicando que aun no esta habilitado para registrar la salida
        throw new ConflictException(
          'Aun no esta habilitado para registrar la asistencia de salida.',
        );
      }
      console.log(perteneceAlCurso);
      return {
        message: 'Asistencia registrada exitosamente.',
        asistencia: perteneceAlCurso.asistente,
        valid: perteneceAlCurso.valid,
      };
    } catch (error) {
      throw error;
    }
  }
}

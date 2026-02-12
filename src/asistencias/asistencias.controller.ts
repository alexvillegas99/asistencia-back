import {
  Controller,
  Get,
  Post,
  Body,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Query,
  Res,
  Header,
  StreamableFile,
} from '@nestjs/common';
import { AsistenciasService } from './asistencias.service';
import { CreateAsistenciaDto } from './dto/create-asistencia.dto';
import { ApiBody, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
const BACKGROUND_URL =
  'https://corpfourier.s3.us-east-2.amazonaws.com/marca_agua/marca-reportes.png'; // 👈 cambia aquí si no usas env

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
   @Get('v2')
  @ApiQuery({ 
    name: 'idCurso',
    required: true,
    description: 'El ID del curso para generar el reporte de asistencias',
    example: '64234c3bdcfa0f3f34097e78',
  })
  async findAllV2(@Query('idCurso') idCurso: string) {
      console.log(idCurso)
    return this.asistenciasService.generateAsistenciaReport(idCurso);
  }

  @Post('registrar')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        cedula: { type: 'string', example: '1850459767' },
        cursoId: { type: 'string', example: '64234c3bdcfa0f3f34097e78' },
      },
      required: ['cedula', 'cursoId'],
      example: {
        cedula: '1850459767',
        cursoId: '64234c3bdcfa0f3f34097e78',
      },
    },
  })
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
      const perteneceAlCurso: any =
        await this.asistenciasService.validarAsistenteEnCurso(
          data.cedula,
          data.cursoId,
        );
      console.log(perteneceAlCurso);

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

@Get('por-cedula')
@ApiQuery({ name: 'cedula', required: true, example: '1850459767' })
@ApiQuery({ name: 'cursoId', required: false, example: '676f...' })
async getPorCedula(
  @Query('cedula') cedula: string,
  @Query('cursoId') cursoId?: string,
) {
  if (!cedula?.trim()) throw new BadRequestException('La cédula es requerida.');
  console.log('cursoId', cursoId);
  console.log('cedula', cedula);
  return this.asistenciasService.reportePorCedulaTotal(cedula.trim(), cursoId);
}


@Get('por-cedula/justificadas')
@ApiQuery({ name: 'cedula', required: true, example: '1850459767' })
@ApiQuery({ name: 'cursoId', required: false, example: '676f...' })
async getPorCedulaJustificadas(
  @Query('cedula') cedula: string,
  @Query('cursoId') cursoId?: string,
) {
  if (!cedula?.trim()) throw new BadRequestException('La cédula es requerida.');
  console.log('cursoId', cursoId);
  console.log('cedula', cedula);
  return this.asistenciasService.reportePorCedulaTotalJustificado(cedula.trim(), cursoId);
}


@Get('por-cedula/pdf')
@ApiQuery({ name: 'cedula', required: true })
@ApiQuery({ name: 'cursoId', required: false })
@Header('Content-Type', 'application/pdf')
async pdfPorCedula(
  @Query('cedula') cedula: string,
  @Query('cursoId') cursoId?: string,
): Promise<StreamableFile> {
  const { buffer, filename } =
    await this.asistenciasService.pdfPorCedula(cedula, cursoId);

  return new StreamableFile(buffer, {
    type: 'application/pdf',
    disposition: `attachment; filename="${filename}"`,
  });
}
@Post('justificar-falta')
  async justificarFalta(
    @Body()
    body: {
      cedula: string;
      cursoId: string;
      fecha: string;
      usuario: string;
    },
  ): Promise<{ ok: boolean }> {
    return this.asistenciasService.justificarFalta(body);
  }
}

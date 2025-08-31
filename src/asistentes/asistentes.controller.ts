import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Res,
  HttpException,
  HttpStatus,
  Put,
} from '@nestjs/common';
import { AsistentesService } from './asistentes.service';
import { CreateAsistenteDto } from './dto/create-asistente.dto';
import { UpdateAsistenteDto } from './dto/update-asistente.dto';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import * as XLSX from 'xlsx';
@ApiTags('Asistentes')
@Controller('asistentes')
export class AsistentesController {
  constructor(private readonly asistentesService: AsistentesService) {}

  @Post()
  create(@Body() createAsistenteDto: any) {
    return this.asistentesService.create(createAsistenteDto);
  }

  @Post('batch')
  async createBatch(@Body() createAsistentesDto: any) {
    return await this.asistentesService.createBatch(createAsistentesDto);
  }

  @Get()
  findAll(@Query('cursoId') cursoId: string) {
    return this.asistentesService.findAll(cursoId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.asistentesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAsistenteDto: any) {
    return this.asistentesService.update(id, updateAsistenteDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.asistentesService.remove(id);
  }

  @Get('generate-qr-zip/:cursoId')
  async generateQrZip(@Param() cursoId, @Res() res: Response) {
    try {
      console.log(cursoId);
      // Buscar asistentes por cursoId
      const asistentes = await this.asistentesService.findOne2(cursoId.cursoId);
      console.log(asistentes);
      if (!asistentes || asistentes.length === 0) {
        return res
          .status(404)
          .json({ message: 'No se encontraron asistentes para este curso' });
      }

      // Generar QR y enviar como archivo ZIP
      await this.asistentesService.generateQrZip(asistentes, res);
    } catch (error) {
      console.error('Error al generar QR ZIP:', error);
      return res
        .status(500)
        .json({ message: 'Error al generar los códigos QR' });
    }
  }
  @Post('generate-qr')
  async generateQrForAsistente(@Body() asistente: any, @Res() res: Response) {
    try {
      // Llama al servicio para generar el QR para el asistente
      await this.asistentesService.generateQrForAsistente(asistente, res);
    } catch (error) {
      console.error('Error al generar QR:', error.message);
      throw new HttpException(
        'No se pudo generar el código QR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('generate-qr-app')
  async generateQrForAsistenteApp(
    @Body() asistente: any,
    @Res() res: Response,
  ) {
    try {
      // Llama al servicio para generar el QR para el asistente
      await this.asistentesService.generateQrForAsistenteApp(asistente, res);
    } catch (error) {
      console.error('Error al generar QR:', error.message);
      throw new HttpException(
        'No se pudo generar el código QR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  //Necesito un controaldor de metodo get al que le envio nombre, cedula y nombre del curso. si el curso no existe, lo crea y si el asistente no existe lo crea y lo pone en ese curso esto con query params

  @Post('add/asistente')
  async addAsistente(
    @Query()
    query: {
      nombre: string;
      cedula: string;
      curso: string;
      negocio: string;
      telefono?: string;
      correo?: string;
    },
    @Res() res: Response,
  ) {
     let { nombre, cedula, curso, negocio, telefono, correo } = query;
    console.log(nombre);
    // Validar los parámetros requeridos
    if (!nombre || !cedula || !curso || !negocio) {
      throw new HttpException(
        'Faltan parámetros requeridos: nombre, cedula o curso',
        HttpStatus.BAD_REQUEST,
      );
    }
    curso = curso.trim();
    negocio = negocio.trim();
    nombre = nombre.trim();
    cedula = cedula.trim();

    if (telefono) telefono = telefono.trim();
  if (correo) correo = correo.trim();


    try {
      // Llama al servicio para agregar el asistente al curso
      const result = await this.asistentesService.addAsistente({
        nombre,
        cedula,
        curso,
        negocio,
         telefono,
      correo,
      });
      await this.asistentesService.generateQrForAsistente(result, res);
      // Responde con un mensaje claro
    } catch (error) {
      console.error('Error al agregar asistente:', error.message);

      // Manejo general de errores
      throw new HttpException(
        'No se pudo agregar el asistente. Por favor, intente nuevamente.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('mover/asistente')
  async moverAsistente(
    @Query() query: { cedula: string; curso: string; negocio: string },
    @Res() res: Response,
  ) {
    console.log('cambiando de curso a asistente');
    let { cedula, curso, negocio } = query;

    // Validar los parámetros requeridos
    if (!cedula || !curso || !negocio) {
      throw new HttpException(
        'Faltan parámetros requeridos: cedula o curso o negocio',
        HttpStatus.BAD_REQUEST,
      );
    }

    curso = curso.trim();
    cedula = cedula.trim();
    negocio = negocio.trim();

    try {
      // Llama al servicio para agregar el asistente al curso
      const result = await this.asistentesService.moverAsistente({
        cedula,
        curso,
        negocio,
      });
      await this.asistentesService.generateQrForAsistente(result, res);
      // Responde con un mensaje claro
    } catch (error) {
      console.error('Error al agregar asistente:', error.message);

      // Manejo general de errores
      throw new HttpException(
        'No se pudo agregar el asistente. Por favor, intente nuevamente.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('cambiar/estado/asistente')
  async cambiarEstado(
    @Query() query: { cedula: string; curso: string; estado: string },
    @Res() res: Response,
  ) {
    console.log('111');
    query.curso = query.curso.replace(/ /g, '_');
    const { estado, cedula, curso } = query;
    console.log(query);
    // Validar los parámetros requeridos
    if (!estado || !cedula || !curso) {
      throw new HttpException(
        'Faltan parámetros requeridos: nombre, cedula o curso',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      // Llama al servicio para agregar el asistente al curso
      return await this.asistentesService.cambiarEstadoAsistente({
        cedula,
        curso,
        estado,
      });
    } catch (error) {
      console.error('Error al agregar asistente:', error.message);

      // Manejo general de errores
      throw new HttpException(
        'No se pudo agregar el asistente. Por favor, intente nuevamente.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('generar/qr/bitrix')
  async obtenerQR2(
    @Query() query: { cedula: string; curso: string },
    @Res() res: Response,
  ) {
    query.curso = query.curso.replace(/ /g, '_');
    const { cedula, curso } = query;

    // Validar los parámetros requeridos
    if (!cedula || !curso) {
      throw new HttpException(
        'Faltan parámetros requeridos: cedula o curso',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const cursoB: any = await this.asistentesService.buscarCurso(curso);

      const asistente = await this.asistentesService.buscarAsistente(
        cedula,
        cursoB._id,
      );
      await this.asistentesService.generateQrForAsistente(asistente, res);
    } catch (error) {
      console.error('Error al agregar asistente:', error.message);

      // Manejo general de errores
      throw new HttpException(
        'No se pudo agregar el asistente. Por favor, intente nuevamente.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('todos/asistentes')
  async todos() {
    console.log('Obteniendo todos los asistentes');
    return this.asistentesService.todos();
  }

  @Put('orientacion-vocacional/:id')
  async actualizarOrientacionVocacional(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    console.log('Actualizando orientación vocacional para el asistente:', id);
    return this.asistentesService.actualizarOrientacionVocacional(id, body);
  }

  @Post('cambiar-curso')
  async cambiarCurso(@Body() body: any) {
    console.log('Cambiando curso para el asistente:');
    return await this.asistentesService.cambiarCurso(body);
  }

  @Get('buscar/por-cedula/:cedula')
  async buscarPorCedula(@Param('cedula') cedula: string) {
    console.log('Buscando asistente por cédula:', cedula);
    return await this.asistentesService.buscarPorCedula(cedula);
  }

  // POST /asistentes/migracion/curso/ABC123?confirm=true&batchSize=5000
  //agrega descripcion para identifica
  @Post('curso/:cursoId')
  async migrateCurso(
    @Param('cursoId') cursoId: string,
    @Query('batchSize') batchSize?: string,
  ) {
    const size = Math.max(1, Number(batchSize) || 15000);
    return this.asistentesService.migrateCursoPorId(cursoId, size);
  }

  // POST /asistentes/migracion/todo?confirm=true&batchSize=5000
  @Post('migrar/todo')
  async migrateTodo(@Query('batchSize') batchSize?: string) {
    const size = Math.max(1, Number(batchSize) || 15000);
    return this.asistentesService.migrateTodo(size);
  }

  // GET /asistentes/migrados/buscar?search=&curso=&page=1&limit=10
  @Get('migrados/buscar')
  async list(
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 10));
    return this.asistentesService.findPaginatedMigrados({
      search,
      page: p,
      limit: l,
    });
  }
  // GET /asistentes/migrados/export?search=...
  @Get('migrados/export')
  async export(@Query('search') search: string, @Res() res: Response) {
    const rows = await this.asistentesService.findAllForExport(search);

    // Transformar a estructura de Excel (encabezados en español)
    const data = rows.map((r: any) => {
      const totalAsist =
        (r.asistencias ?? 0) +
        (r.asistenciasInactivas ?? 0) +
        (r.asistenciasAdicionales ?? 0);

      return {
        Cédula: r.cedula || '',
        Nombre: r.nombre || '',
        Curso: r.curso || 'curso no registrado',
        Asistencias: totalAsist,
        Inasistencias: r.inasistencias ?? 0,
        Adicionales: r.asistenciasAdicionales ?? 0,
        'Creado (EC)': r.createdAtEcuador ? new Date(r.createdAtEcuador) : '',
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data, { cellDates: true });
    // Anchos de columna
    ws['!cols'] = [
      { wch: 14 }, // Cédula
      { wch: 32 }, // Nombre
      { wch: 18 }, // Curso
      { wch: 10 }, // Estado
      { wch: 12 }, // Asistencias
      { wch: 13 }, // Inasistencias
      { wch: 12 }, // Adicionales
      { wch: 20 }, // Creado (EC)
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Migrados');

    // XLS binario (legacy .xls)
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xls' });

    const filename = `asistentes_migrados_${new Date().toISOString().slice(0, 10)}.xls`;
    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  }
}

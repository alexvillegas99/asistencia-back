import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Res, HttpException, HttpStatus } from '@nestjs/common';
import { AsistentesService } from './asistentes.service';
import { CreateAsistenteDto } from './dto/create-asistente.dto';
import { UpdateAsistenteDto } from './dto/update-asistente.dto';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

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
    return  await this.asistentesService.createBatch(createAsistentesDto);
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
      console.log( cursoId);
      // Buscar asistentes por cursoId
      const asistentes = await this.asistentesService.findOne2(cursoId.cursoId);
      console.log(asistentes);
      if (!asistentes || asistentes.length === 0) {
        return res.status(404).json({ message: 'No se encontraron asistentes para este curso' });
      }
  
      // Generar QR y enviar como archivo ZIP
      await this.asistentesService.generateQrZip(asistentes, res);
    } catch (error) {
      console.error('Error al generar QR ZIP:', error);
      return res.status(500).json({ message: 'Error al generar los códigos QR' });
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
  //Necesito un controaldor de metodo get al que le envio nombre, cedula y nombre del curso. si el curso no existe, lo crea y si el asistente no existe lo crea y lo pone en ese curso esto con query params


@Post('add/asistente')
async addAsistente(@Query() query: { nombre: string; cedula: string; curso: string, negocio:string }, @Res() res: Response) {
  const { nombre, cedula, curso,negocio } = query;
  console.log(nombre);
  // Validar los parámetros requeridos
  if (!nombre || !cedula || !curso || !negocio) {
    throw new HttpException(
      'Faltan parámetros requeridos: nombre, cedula o curso',
      HttpStatus.BAD_REQUEST
    );
  }

  try {
    // Llama al servicio para agregar el asistente al curso
    const result = await this.asistentesService.addAsistente({ nombre, cedula, curso,negocio });
    await this.asistentesService.generateQrForAsistente(result, res);
    // Responde con un mensaje claro

  } catch (error) {
    console.error('Error al agregar asistente:', error.message);
 
    // Manejo general de errores
    throw new HttpException(
      'No se pudo agregar el asistente. Por favor, intente nuevamente.',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

@Post('mover/asistente')
async moverAsistente(@Query() query: { cedula: string; curso: string,  }, @Res() res: Response) {
  console.log('cambiando de curso a asistente')
  const {  cedula, curso } = query;
  // Validar los parámetros requeridos
  if ( !cedula || !curso ) {
    throw new HttpException(
      'Faltan parámetros requeridos: cedula o curso',
      HttpStatus.BAD_REQUEST
    );
  }

  try {
    // Llama al servicio para agregar el asistente al curso
    const result = await this.asistentesService.moverAsistente({ cedula, curso});
    await this.asistentesService.generateQrForAsistente(result, res);
    // Responde con un mensaje claro

  } catch (error) {
    console.error('Error al agregar asistente:', error.message);
 
    // Manejo general de errores
    throw new HttpException(
      'No se pudo agregar el asistente. Por favor, intente nuevamente.',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

@Post('cambiar/estado/asistente')
async cambiarEstado(@Query() query: {  cedula: string; curso: string, estado: string }, @Res() res: Response) {
  console.log('111')
   query.curso  = query.curso.replace(/ /g, "_");
  const { estado, cedula, curso } = query;
  console.log(query);
  // Validar los parámetros requeridos
  if (!estado || !cedula || !curso) {
    throw new HttpException(
      'Faltan parámetros requeridos: nombre, cedula o curso',
      HttpStatus.BAD_REQUEST
    );
  } 

  try {
    // Llama al servicio para agregar el asistente al curso
   return await this.asistentesService.cambiarEstadoAsistente({ cedula, curso,estado });

  
  } catch (error) {
    console.error('Error al agregar asistente:', error.message);
 
    // Manejo general de errores
    throw new HttpException(
      'No se pudo agregar el asistente. Por favor, intente nuevamente.',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

@Get('generar/qr/bitrix')
async obtenerQR2(@Query() query: {  cedula: string; curso: string}, @Res() res: Response) {
  query.curso  = query.curso.replace(/ /g, "_");
  const {  cedula, curso } = query;
  
  // Validar los parámetros requeridos
  if ( !cedula || !curso) {
    throw new HttpException(
      'Faltan parámetros requeridos: cedula o curso',
      HttpStatus.BAD_REQUEST
    );
  }

  try {


    const cursoB:any = await this.asistentesService.buscarCurso(curso);

    const asistente = await this.asistentesService.buscarAsistente(cedula,cursoB._id);
    await this.asistentesService.generateQrForAsistente(asistente, res);
  } catch (error) {
    console.error('Error al agregar asistente:', error.message);
 
    // Manejo general de errores
    throw new HttpException(
      'No se pudo agregar el asistente. Por favor, intente nuevamente.',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}






}

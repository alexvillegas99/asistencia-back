import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CodigoProfesoresService } from './codigos_profesores.service';

@Controller('codigos-profesores')
export class CodigosProfesoresController {
  constructor(private readonly codigosProfesoresService: CodigoProfesoresService) {}

  @Get('generar/:profesorId')
  async generarCodigo(@Param('profesorId') profesorId: string) {
    return  await this.codigosProfesoresService.generarCodigo(profesorId);
  }

  @Get('vaidar/:codigo')
  async validarCodigo(@Param('codigo') codigo: string) {
    return await this.codigosProfesoresService.vaidarCodigo(codigo);
  }
}

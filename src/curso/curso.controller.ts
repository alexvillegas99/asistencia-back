import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';

import { CreateCursoDto } from './dto/create-curso.dto';
import { UpdateCursoDto } from './dto/update-curso.dto';
import { ApiTags } from '@nestjs/swagger';
import { CursoService } from './curso.service';

@ApiTags('Cursos')
@Controller('cursos')
export class CursoController {
  constructor(private readonly cursosService: CursoService) {}

  @Post()
  async create(@Body() createCursoDto: any) {
    return await this.cursosService.create(createCursoDto);
  }

  @Get()
  async findAll(@Query('estado') estado?: string) {
    console.log("cursossss")
    return await this.cursosService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.cursosService.findOne(id);
  }


  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateCursoDto: any) {
    return await this.cursosService.update(id, updateCursoDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.cursosService.remove(id);
  }
}

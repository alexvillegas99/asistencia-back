import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CampanasService } from './campanas.service';
import { CreateCampanaDto } from './dto/create-campana.dto';
import { UpdateCampanaDto } from './dto/update-campana.dto';
import { ApiTags } from '@nestjs/swagger';
ApiTags('campanas')
@Controller('campanas')
export class CampanasController {
  constructor(private readonly campanasService: CampanasService) {}

  @Post()
  crear(@Body() dto: any) {
    return this.campanasService.crear(dto);
  }

  @Patch(':id')
  editar(@Param('id') id: string, @Body() dto: any) {
    return this.campanasService.editar(id, dto);
  }

  @Get()
  obtenerTodas() {
    return this.campanasService.obtenerTodas();
  }

  @Get('/activas')
  obtenerActivas() {
    return this.campanasService.obtenerActivas();
  }

  @Get('/inactivas')
  obtenerInactivas() {
    return this.campanasService.obtenerInactivas();
  }

  
}

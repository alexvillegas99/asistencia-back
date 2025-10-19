// src/modules/skool/lesson/lesson.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { LessonService } from './lesson.service';

/**
 * Controlador de Lecciones (Admin)
 * Convención de rutas bajo /skool, similar a Sections.
 */
@Controller('skool')
export class LessonController {
  constructor(private readonly lessons: LessonService) {}

  /**
   * Crear una lección en una sección.
   * Requiere en body: { courseId, title, ... }
   * sectionId se toma desde la ruta.
   */
  @Post('sections/:sectionId/lessons')
  create(
    @Param('sectionId') sectionId: string,
    @Body() dto: Omit<any, 'sectionId'>,
  ) {
    return this.lessons.create({ ...dto, sectionId });
  }

  /**
   * Listar lecciones de una sección, ordenadas por sortIndex (y createdAt).
   * Opcionalmente acepta paginación liviana (?page, ?limit) si luego quieres agregarla en service.
   */
  @Get('sections/:sectionId/lessons')
  listBySection(
    @Param('sectionId') sectionId: string,
    @Query('page') _page?: string,
    @Query('limit') _limit?: string,
  ) {
    // Versión simple: retorno completo. Si luego quieres paginar, ajusta el service y aquí parsea page/limit.
    return this.lessons.listBySection(sectionId);
  }

  /**
   * Obtener una lección por id.
   */
  @Get('lessons/:id')
  getOne(@Param('id') id: string) {
    return this.lessons.get(id);
  }

  /**
   * Actualizar una lección.
   * Puede mover de sección enviando { sectionId } en el body.
   */
  @Patch('lessons/:id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.lessons.update(id, dto);
  }

  /**
   * Eliminar una lección por id.
   */
  @Delete('lessons/:id')
  remove(@Param('id') id: string) {
    return this.lessons.remove(id);
  }

  /**
   * Reordenar las lecciones de una sección.
   * Body: { ids: string[] } en el nuevo orden 0..n
   */
  @Patch('sections/:sectionId/lessons/reorder')
  reorder(
    @Param('sectionId') sectionId: string,
    @Body() body: any,
  ) {
    return this.lessons.reorder(sectionId, body.ids);
  } 

   @Post('lessons/:lessonId/attachments')
  async attach(
    @Param('lessonId') lessonId: string,
    @Body() body: { mediaId: string }
  ) {
    if (!body?.mediaId) throw new NotFoundException('mediaId requerido');
    return this.lessons.addAttachment(lessonId, body.mediaId);
  }

  @Delete('lessons/:lessonId/attachments/:mediaId')
  async detach(@Param('lessonId') lessonId: string, @Param('mediaId') mediaId: string) {
    return this.lessons.removeAttachment(lessonId, mediaId);
  }
}

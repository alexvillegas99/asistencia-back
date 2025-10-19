// src/modules/skool/section/section.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { SectionService } from './section.service';

import { LessonService } from '../lesson/lesson.service';

@Controller('skool')
export class SectionController {
  constructor(
    private readonly sections: SectionService,
    private readonly lessons: LessonService, // para validar eliminación
  ) {}

  // Crear
  @Post('courses/:courseId/sections')
  create(@Param('courseId') courseId: string, @Body() dto: Omit<any,'courseId'>) {
    return this.sections.create({ ...dto, courseId });
  }

  // Listar por curso
  @Get('courses/:courseId/sections')
  list(@Param('courseId') courseId: string) {
    return this.sections.listByCourse(courseId);
  }

  // Reordenar secciones del curso
  @Patch('courses/:courseId/sections/reorder')
  reorder(@Param('courseId') courseId: string, @Body() body: any) {
    return this.sections.reorder(courseId, body.ids);
  }

  // Actualizar
  @Patch('sections/:id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.sections.update(id, dto);
  }

  // Eliminar (bloquea si tiene lecciones)
  @Delete('sections/:id')
  async remove(@Param('id') id: string) {
    const hasLessons = await this.lessons.countBySection(id);
    if (hasLessons > 0) {
      return { ok: false, error: 'No se puede eliminar: la sección tiene lecciones' };
    }
    return this.sections.remove(id);
  }

  // Curriculum completo: secciones + lecciones
  @Get('courses/:courseId/curriculum')
  async curriculum(@Param('courseId') courseId: string) {
    const sections = await this.sections.listByCourse(courseId);
    const items = await this.lessons.listByCourseGrouped(courseId);
    const map = new Map(items.map(s => [String(s._id), s.lessons]));
    return sections.map(s => ({ ...s, lessons: map.get(String(s._id)) ?? [] }));
  }
}

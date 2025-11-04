import { Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { LessonRepo } from './repos/lesson.repo';

import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
const asObjectId = (v: string) => new Types.ObjectId(v);
const isValidId = (v: any) => typeof v === 'string' && Types.ObjectId.isValid(v);
@Injectable()
export class LessonService {
  constructor(private readonly repo: LessonRepo) {}

  async create(dto: any) {
    const courseId = new Types.ObjectId(dto.courseId);
    const sectionId = new Types.ObjectId(dto.sectionId);
    const sortIndex = (await this.repo.lastIndex(dto.courseId, dto.sectionId)) + 1;

    return this.repo.create({
      courseId,
      sectionId,
      title: dto.title.trim(),
      content: dto.content ?? '',
      durationSec: dto.durationSec ?? 0,
      isPreview: dto.isPreview ?? false,
      status: dto.status ?? 'draft',
      sortIndex,
    });
  }

  async get(id: string) {
    const one = await this.repo.findById(id);
    if (!one) throw new NotFoundException('Lección no encontrada');
    return one;
  }

  listBySection(sectionId: string) {
    return this.repo.findBySection(sectionId);
  }

  listByCourseGrouped(courseId: string) {
    return this.repo.findByCourseGrouped(courseId);
  }

  countBySection(sectionId: string) {
    return this.repo.countBySection(sectionId);
  }

    asObjectId(id: string | Types.ObjectId) {
    return typeof id === 'string' ? new Types.ObjectId(id) : id;
  }

    private buildSafePatch(dto: any): any {
    const patch: any = {};

    if (dto.title !== undefined) patch.title = String(dto.title).trim();
    if (dto.content !== undefined) patch.content = String(dto.content);
    if (dto.status !== undefined) patch.status = String(dto.status);
    if (dto.isPreview !== undefined) patch.isPreview = !!dto.isPreview;
    if (dto.durationSec !== undefined) {
      const n = Number(dto.durationSec);
      patch.durationSec = Number.isFinite(n) ? n : 0;
    }

    // ⚠️ Validación solicitada: solo setear si es ObjectId válido
    if (dto.videoMediaId !== undefined) {
      if (isValidId(dto.videoMediaId)) {
        patch.videoMediaId = asObjectId(dto.videoMediaId);
      }
      // Si NO es válido, se ignora: NO setea ni borra el campo existente.
    }

    // No permitir cambiar sortIndex manualmente vía dto
    delete patch.sortIndex;

    return patch;
  }

 async update(id: string, dto: any) {
    // Caso: mover de sección → calcular nuevo sortIndex al final de la nueva sección
    if (dto.sectionId) {
      const newSectionId = asObjectId(dto.sectionId);

      // Intenta obtener courseId desde dto o, si no viene, desde la lección actual
      let courseIdForIndex: string | Types.ObjectId | undefined = dto.courseId;
      if (!courseIdForIndex) {
        const current = await this.repo.findById(id);
        if (!current) throw new NotFoundException('Lección no encontrada');
        courseIdForIndex = current.courseId;
      }

      const newIndex =
        (await this.repo.lastIndex(
          String(courseIdForIndex),
          String(newSectionId),
        )) + 1;

      const patch = this.buildSafePatch(dto);
      patch.sectionId = newSectionId;
      patch.sortIndex = newIndex; // se recalcula

      const moved = await this.repo.updateById(id, patch);
      if (!moved) throw new NotFoundException('Lección no encontrada');
      return moved;
    }

    // Update normal (misma sección)
    const patch = this.buildSafePatch(dto);
    const upd = await this.repo.updateById(id, patch);
    if (!upd) throw new NotFoundException('Lección no encontrada');
    return upd;
  }

  async remove(id: string) {
    const res = await this.repo.deleteById(id);
    if (!res.deletedCount) throw new NotFoundException('Lección no encontrada');
    return { ok: true };
  }

  async reorder(sectionId: string, ids: string[]) {
    await this.repo.bulkReorder(sectionId, ids);
    return this.repo.findBySection(sectionId);
  }

   addAttachment(lessonId: string, mediaId: string) {
    return this.repo.addAttachment(lessonId, mediaId);
  }

  removeAttachment(lessonId: string, mediaId: string) {
    return this.repo.removeAttachment(lessonId, mediaId);
  }

  
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { LessonRepo } from './repos/lesson.repo';

import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

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

  async update(id: string, dto: any) {
    // mover de sección: calcula nuevo sortIndex al final
    if (dto.sectionId) {
      const newIndex = (await this.repo.lastIndex(
        (dto as any).courseId || '', // opcional si lo mandas
        dto.sectionId,
      )) + 1;

      const moved = await this.repo.updateById(id, {
        ...dto,
        sectionId: new Types.ObjectId(dto.sectionId),
        sortIndex: newIndex,
      });
      if (!moved) throw new NotFoundException('Lección no encontrada');
      return moved;
    }

    const upd = await this.repo.updateById(id, dto);
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

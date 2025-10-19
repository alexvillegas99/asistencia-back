import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { SectionRepo } from './repos/section.repo';


@Injectable()
export class SectionService {
  constructor(private readonly repo: SectionRepo) {}

  async create(dto: any) {
    const courseId = new Types.ObjectId(dto.courseId);
    const sortIndex = (await this.repo.lastIndex(dto.courseId)) + 1;

    return this.repo.create({
      courseId,
      title: dto.title.trim(),
      summary: dto.summary ?? '',
      status: dto.status ?? 'draft',
      sortIndex,
    });
  }

  listByCourse(courseId: string) {
    console.log('Listing sections for courseId:', courseId);
    return this.repo.findByCourse(courseId);
  }

  async update(id: string, dto: any) {
    const updated = await this.repo.updateById(id, dto);
    if (!updated) throw new NotFoundException('Sección no encontrada');
    return updated;
  }

  async remove(id: string) {
    const found = await this.repo.findById(id);
    if (!found) throw new NotFoundException('Sección no encontrada');
    await this.repo.deleteById(id);
    return { ok: true };
  }

  async reorder(courseId: string, ids: string[]) {
    if (!ids?.length) throw new BadRequestException('Nada que reordenar');
    await this.repo.bulkReorder(courseId, ids);
    return this.repo.findByCourse(courseId);
  }
}

// src/modules/skool/enrollment/enrollment.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { EnrollmentRepo } from './repos/enrollment.repo';
import { EnrollDto } from './dto/enroll.dto';
import { ProgressDto } from './dto/progress.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
@Injectable()
export class EnrollmentService {
  constructor(private readonly repo: EnrollmentRepo) {}

  async enroll(dto: EnrollDto) {
    if (!dto.userId && !dto.externalUserId) {
      throw new BadRequestException('Debe especificar userId o externalUserId');
    }
    if (dto.userId && dto.externalUserId) {
      throw new BadRequestException('Use solo uno: userId o externalUserId');
    }

    const data: any = {
      courseId: new Types.ObjectId(dto.courseId),
      startedAt: new Date(),
      status: 'active',
      meta: dto.meta ?? {},
    };
    if (dto.userId) data.userId = new Types.ObjectId(dto.userId);
    if (dto.externalUserId) data.externalUserId = new Types.ObjectId(dto.externalUserId);

    // evita duplicados (respeta índices únicos)
    const exists = await this.repo.findOne({
      courseId: data.courseId,
      ...(data.userId ? { userId: data.userId } : {}),
      ...(data.externalUserId ? { externalUserId: data.externalUserId } : {}),
    });
    if (exists) return exists;

    return this.repo.create(data);
  }

  async get(id: string) {
    const e = await this.repo.findById(id);
    if (!e) throw new NotFoundException('Matrícula no encontrada');
    return e;
  }

  list(params: { courseId?: string; userId?: string; externalUserId?: string; status?: string; limit?: number; skip?: number }) {
    const filter: any = {};
    if (params.courseId) filter.courseId = new Types.ObjectId(params.courseId);
    if (params.userId) filter.userId = new Types.ObjectId(params.userId);
    if (params.externalUserId) filter.externalUserId = new Types.ObjectId(params.externalUserId);
    if (params.status) filter.status = params.status;
    return this.repo.list(filter, params.limit ?? 50, params.skip ?? 0);
  }

  async updateStatus(id: string, dto: UpdateStatusDto) {
    const update: any = { status: dto.status };
    if (dto.status === 'completed') update.completedAt = new Date();
    const e = await this.repo.updateById(id, update);
    if (!e) throw new NotFoundException('Matrícula no encontrada');
    return e;
  }

  async unregister(id: string) {
    const e = await this.repo.deleteById(id);
    if (!e) throw new NotFoundException('Matrícula no encontrada');
    return { ok: true };
  }

  async pushProgress(id: string, body: ProgressDto) {
    const e = await this.repo.findById(id);
    if (!e) throw new NotFoundException('Matrícula no encontrada');

    const map = new Map<string, { progress: number; completedAt?: Date }>();
    for (const lp of e.lessonsProgress ?? []) {
      map.set(String(lp.lessonId), { progress: lp.progress, completedAt: lp.completedAt });
    }

    for (const u of body.updates ?? []) {
      const lessonId = String(u.lessonId);
      const prev = map.get(lessonId) ?? { progress: 0 };
      const p = Math.max(0, Math.min(100, Number(u.progress)));
      const completedAt = p === 100 ? (prev.completedAt ?? new Date()) : prev.completedAt;
      map.set(lessonId, { progress: p, completedAt });
    }

    const lessonsProgress = Array.from(map.entries()).map(([lessonId, v]) => ({
      lessonId: new Types.ObjectId(lessonId),
      progress: v.progress,
      completedAt: v.completedAt,
    }));

    // si todas 100% → status completed
    const allCompleted = lessonsProgress.length > 0 && lessonsProgress.every(x => x.progress === 100);
    const update: any = { lessonsProgress };
    if (allCompleted) {
      update.status = 'completed';
      update.completedAt = e.completedAt ?? new Date();
    }

    const updated = await this.repo.updateById(id, update);
    return updated!;
  }
}

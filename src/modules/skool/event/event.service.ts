// event.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose'; import { EventRepo } from './repos/event.repo';
import { CreateEventDto } from './dto/create-event.dto';
export class UpdateEventDto extends CreateEventDto {}
@Injectable() export class EventService {
  constructor(private readonly repo: EventRepo) {}
  create(dto: CreateEventDto) {
    const data: any = {
      communityId: new Types.ObjectId(dto.communityId),
      courseId: dto.courseId ? new Types.ObjectId(dto.courseId) : undefined,
      title: dto.title.trim(), description: dto.description ?? '',
      startsAt: new Date(dto.startsAt), endsAt: new Date(dto.endsAt),
      locationType: dto.locationType ?? 'online', location: dto.location ?? '',
      allDay: !!dto.allDay,
      attachments: (dto.attachments ?? []).map(id => new Types.ObjectId(id)),
    };
    return this.repo.create(data);
  }
  list(q: { communityId: string; from?: string; to?: string; courseId?: string; limit?: number; skip?: number; }) {
    const f: any = { communityId: new Types.ObjectId(q.communityId) };
    if (q.courseId) f.courseId = new Types.ObjectId(q.courseId);
    if (q.from || q.to) f.startsAt = {};
    if (q.from) f.startsAt.$gte = new Date(q.from);
    if (q.to) f.startsAt.$lte = new Date(q.to);
    return this.repo.list(f, q.limit ?? 50, q.skip ?? 0);
  }
  async update(id: string, dto: UpdateEventDto) {
    const upd: any = { ...dto };
    if (dto.communityId) upd.communityId = new Types.ObjectId(dto.communityId);
    if (dto.courseId) upd.courseId = new Types.ObjectId(dto.courseId);
    if (dto.startsAt) upd.startsAt = new Date(dto.startsAt);
    if (dto.endsAt) upd.endsAt = new Date(dto.endsAt);
    if (dto.attachments) upd.attachments = dto.attachments.map(id => new Types.ObjectId(id));
    const e = await this.repo.updateById(id, upd); if (!e) throw new NotFoundException('Evento no encontrado'); return e;
  }
  async remove(id: string) {
    const e = await this.repo.deleteById(id); if (!e) throw new NotFoundException('Evento no encontrado'); return { ok: true };
  }
}

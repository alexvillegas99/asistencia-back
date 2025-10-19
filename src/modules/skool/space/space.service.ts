// space.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { SpaceRepo } from './repos/space.repo';
function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
@Injectable()
export class SpaceService {
  constructor(private readonly repo: SpaceRepo) {}
  async create(dto: any) {
    const slugBase = slugify(dto.name);
    let slug = slugBase,
      i = 1;
    while (
      await this.repo.findOne({
        communityId: new Types.ObjectId(dto.communityId),
        slug,
      })
    )
      slug = `${slugBase}-${i++}`;
    return this.repo.create({
      communityId: new Types.ObjectId(dto.communityId),
      name: dto.name.trim(),
      slug,
      description: dto.description ?? '',
      status: dto.status ?? 'active',
      sortIndex: dto.sortIndex ?? 0,
      settings: {},
    });
  }
  list(q: {
    communityId: string;
    status?: string;
    limit?: number;
    skip?: number;
  }) {
    const f: any = { communityId: new Types.ObjectId(q.communityId) };
    if (q.status) f.status = q.status;
    return this.repo.list(f, q.limit ?? 100, q.skip ?? 0);
  }
  async update(id: string, dto: any) {
    const upd: any = { ...dto };
    if (dto.name) upd.name = dto.name.trim();
    const s = await this.repo.updateById(id, upd);
    if (!s) throw new NotFoundException('Space no encontrado');
    return s;
  }
  async remove(id: string) {
    const s = await this.repo.deleteById(id);
    if (!s) throw new NotFoundException('Space no encontrado');
    return { ok: true };
  }
}

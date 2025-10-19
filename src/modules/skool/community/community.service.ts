// src/modules/skool/community/community.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { CommunityRepo } from './repos/community.repo';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';

function simpleSlug(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

@Injectable()
export class CommunityService {
  constructor(private readonly repo: CommunityRepo) {}

  async create(dto: CreateCommunityDto) {

try {
  
  const slugBase = simpleSlug(dto.name);
    if (!slugBase) throw new BadRequestException('Nombre inválido');

    let slug = slugBase;
    let i = 1;
    while (await this.repo.findOne({ slug })) slug = `${slugBase}-${i++}`;

    const data: any = {
      name: dto.name.trim(),
      slug,
      description: dto.description ?? '',
      ownerId: new Types.ObjectId(dto.ownerId),
      visibility: dto.visibility ?? 'private',
      status: 'active',
    };
    if (dto.avatarMediaId) data.avatarMediaId = new Types.ObjectId(dto.avatarMediaId);
    if (dto.bannerMediaId) data.bannerMediaId = new Types.ObjectId(dto.bannerMediaId);

    return this.repo.create(data);
    } catch (error) {
      console.error(error);
      throw new BadRequestException(
        'Error al crear la comunidad: ' + (error?.message || error),
      );
    }
  }

  async findById(id: string) {
    const doc = await this.repo.findById(id);
    if (!doc) throw new NotFoundException('Comunidad no encontrada');
    return doc;
  }

  list(params: { q?: string; visibility?: string; status?: string; ownerId?: string; limit?: number; skip?: number }) {
    const filter: any = {};
    if (params.q) filter.$or = [{ name: new RegExp(params.q, 'i') }, { slug: new RegExp(params.q, 'i') }];
    if (params.visibility) filter.visibility = params.visibility;
    if (params.status) filter.status = params.status;
    if (params.ownerId) filter.ownerId = new Types.ObjectId(params.ownerId);
    return this.repo.list(filter, params.limit ?? 50, params.skip ?? 0);
  }

  async update(id: string, dto: UpdateCommunityDto) {
    const upd: any = { ...dto };
    if (dto.avatarMediaId) upd.avatarMediaId = new Types.ObjectId(dto.avatarMediaId);
    if (dto.bannerMediaId) upd.bannerMediaId = new Types.ObjectId(dto.bannerMediaId);
    const doc = await this.repo.updateById(id, upd);
    if (!doc) throw new NotFoundException('Comunidad no encontrada');
    return doc;
  }

  async remove(id: string) {
    const doc = await this.repo.deleteById(id);
    if (!doc) throw new NotFoundException('Comunidad no encontrada');
    return { ok: true };
  }
}

// src/modules/skool/post/post.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PostRepo } from './repos/post.repo';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostService {
  constructor(private readonly repo: PostRepo) {}

  async create(dto: CreatePostDto) {
    if (!dto.authorId && !dto.externalAuthorId) {
      throw new BadRequestException('Debe indicar authorId o externalAuthorId');
    }
    const data: any = {
      communityId: new Types.ObjectId(dto.communityId),
      spaceId: dto.spaceId ? new Types.ObjectId(dto.spaceId) : undefined,
      title: dto.title.trim(),
      body: dto.body ?? '',
      attachments: (dto.attachments ?? []).map(id => new Types.ObjectId(id)),
      pinned: false,
      reactions: {},
    };
    if (dto.authorId) data.authorId = new Types.ObjectId(dto.authorId);
    if (dto.externalAuthorId) data.externalAuthorId = new Types.ObjectId(dto.externalAuthorId);
    return this.repo.create(data);
  }

  async findById(id: string) {
    const post = await this.repo.findById(id);
    if (!post) throw new NotFoundException('Post no encontrado');
    return post;
  }

  list(params: { communityId: string; spaceId?: string; q?: string; limit?: number; skip?: number }) {
    const filter: any = { communityId: new Types.ObjectId(params.communityId) };
    if (params.spaceId) filter.spaceId = new Types.ObjectId(params.spaceId);
    if (params.q) filter.$or = [{ title: new RegExp(params.q, 'i') }, { body: new RegExp(params.q, 'i') }];
    return this.repo.list(filter, params.limit ?? 50, params.skip ?? 0);
  }

  async update(id: string, dto: UpdatePostDto, actor?: { userId?: string; externalUserId?: string; isModOrAdmin?: boolean }) {
    if (!actor?.isModOrAdmin) {
      const ok = await this.repo.isAuthor(id, actor?.userId, actor?.externalUserId);
      if (!ok) throw new NotFoundException('No autorizado o post no encontrado');
    }
    const update: any = { ...dto };
    if (dto.attachments) update.attachments = dto.attachments.map(id => new Types.ObjectId(id));
    const post = await this.repo.updateById(id, update);
    if (!post) throw new NotFoundException('Post no encontrado');
    return post;
  }

  async remove(id: string, actor?: { userId?: string; externalUserId?: string; isModOrAdmin?: boolean }) {
    if (!actor?.isModOrAdmin) {
      const ok = await this.repo.isAuthor(id, actor?.userId, actor?.externalUserId);
      if (!ok) throw new NotFoundException('No autorizado o post no encontrado');
    }
    const post = await this.repo.deleteById(id);
    if (!post) throw new NotFoundException('Post no encontrado');
    return { ok: true };
  }
}

// comment.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose'; import { CommentRepo } from './repos/comment.repo';
import { CreateCommentDto } from './dto/create-comment.dto'; import { UpdateCommentDto } from './dto/update-comment.dto';
@Injectable() export class CommentService {
  constructor(private readonly repo: CommentRepo) {}
  create(dto: CreateCommentDto) {
    const data: any = {
      postId: new Types.ObjectId(dto.postId),
      communityId: new Types.ObjectId(dto.communityId),
      body: dto.body ?? '',
      attachments: (dto.attachments ?? []).map(id => new Types.ObjectId(id)),
    };
    if (dto.authorId) data.authorId = new Types.ObjectId(dto.authorId);
    if (dto.externalAuthorId) data.externalAuthorId = new Types.ObjectId(dto.externalAuthorId);
    return this.repo.create(data);
  }
  listByPost(postId: string, limit=100, skip=0) {
    return this.repo.list({ postId: new Types.ObjectId(postId) }, limit, skip);
  }
  async update(id: string, dto: UpdateCommentDto, actor?: { userId?: string; externalUserId?: string; isModOrAdmin?: boolean }) {
    const c = await this.repo.findById(id); if (!c) throw new NotFoundException('Comentario no encontrado');
    if (!actor?.isModOrAdmin) {
      const isOwner = (actor?.userId && String(c.authorId)===String(actor.userId)) ||
                      (actor?.externalUserId && String(c.externalAuthorId)===String(actor.externalUserId));
      if (!isOwner) throw new NotFoundException('No autorizado o comentario no encontrado');
    }
    const upd: any = { ...dto };
    if (dto.attachments) upd.attachments = dto.attachments.map(id => new Types.ObjectId(id));
    return this.repo.updateById(id, upd);
  }
  async remove(id: string, actor?: { userId?: string; externalUserId?: string; isModOrAdmin?: boolean }) {
    const c = await this.repo.findById(id); if (!c) throw new NotFoundException('Comentario no encontrado');
    if (!actor?.isModOrAdmin) {
      const isOwner = (actor?.userId && String(c.authorId)===String(actor.userId)) ||
                      (actor?.externalUserId && String(c.externalAuthorId)===String(actor.externalUserId));
      if (!isOwner) throw new NotFoundException('No autorizado o comentario no encontrado');
    }
    await this.repo.deleteById(id); return { ok: true };
  }
}

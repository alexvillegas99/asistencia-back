// moderation.service.ts
import { Injectable, NotFoundException } from '@nestjs/common'; import { Types } from 'mongoose';
import { ModerationRepo } from './repos/moderation.repo';
@Injectable() export class ModerationService {
  constructor(private readonly repo: ModerationRepo) {}
  create(body: { communityId: string; targetType: 'post'|'comment'|'lesson'|'course'; targetId: string; reason: string; reporterId?: string; externalReporterId?: string; }) {
    const data: any = {
      communityId: new Types.ObjectId(body.communityId),
      targetType: body.targetType, targetId: new Types.ObjectId(body.targetId),
      reason: body.reason,
    };
    if (body.reporterId) data.reporterId = new Types.ObjectId(body.reporterId);
    if (body.externalReporterId) data.externalReporterId = new Types.ObjectId(body.externalReporterId);
    return this.repo.create(data);
  }
  list(q: { communityId: string; status?: string; targetType?: string; limit?: number; skip?: number; }) {
    const f: any = { communityId: new Types.ObjectId(q.communityId) }; if (q.status) f.status = q.status; if (q.targetType) f.targetType = q.targetType;
    return this.repo.list(f, q.limit ?? 50, q.skip ?? 0);
  }
  async setStatus(id: string, status: 'open'|'reviewing'|'resolved'|'rejected', resolutionNote?: string, reviewedById?: string) {
    const upd: any = { status, resolutionNote: resolutionNote ?? '' };
    if (reviewedById) upd.reviewedById = new Types.ObjectId(reviewedById);
    const r = await this.repo.updateById(id, upd); if (!r) throw new NotFoundException('Reporte no encontrado'); return r;
  }
}

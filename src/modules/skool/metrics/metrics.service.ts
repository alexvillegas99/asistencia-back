// metrics.service.ts
import { Injectable } from '@nestjs/common'; import { Types } from 'mongoose';
import { MetricsRepo } from './repos/metrics.repo';
@Injectable() export class MetricsService {
  constructor(private readonly repo: MetricsRepo) {}
  track(e: { communityId: string; type: string; courseId?: string; lessonId?: string; quizId?: string; userId?: string; externalUserId?: string; meta?: any; }) {
    const data: any = { communityId: new Types.ObjectId(e.communityId), type: e.type, meta: e.meta ?? {} };
    if (e.courseId) data.courseId = new Types.ObjectId(e.courseId);
    if (e.lessonId) data.lessonId = new Types.ObjectId(e.lessonId);
    if (e.quizId) data.quizId = new Types.ObjectId(e.quizId);
    if (e.userId) data.userId = new Types.ObjectId(e.userId);
    if (e.externalUserId) data.externalUserId = new Types.ObjectId(e.externalUserId);
    return this.repo.create(data);
  }
  list(q: { communityId: string; type?: string; limit?: number; skip?: number; }) {
    const f: any = { communityId: new Types.ObjectId(q.communityId) }; if (q.type) f.type = q.type;
    return this.repo.list(f, q.limit ?? 100, q.skip ?? 0);
  }
  aggDaily(communityId: string, type?: string, from?: string, to?: string) {
    return this.repo.aggDaily(communityId, type, from ? new Date(from) : undefined, to ? new Date(to) : undefined);
  }
}

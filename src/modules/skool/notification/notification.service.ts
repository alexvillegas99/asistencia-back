// notification.service.ts
import { Injectable } from '@nestjs/common'; import { Types } from 'mongoose';
import { NotificationRepo } from './repos/notification.repo';
@Injectable() export class NotificationService {
  constructor(private readonly repo: NotificationRepo) {}
  notify(n: { communityId: string; title: string; body?: string; kind?: any; userId?: string; externalUserId?: string; actionUrl?: string; meta?: any; }) {
    const data: any = {
      communityId: new Types.ObjectId(n.communityId),
      title: n.title, body: n.body ?? '', kind: n.kind ?? 'system',
      actionUrl: n.actionUrl ?? '', meta: n.meta ?? {}, read: false,
    };
    if (n.userId) data.userId = new Types.ObjectId(n.userId);
    if (n.externalUserId) data.externalUserId = new Types.ObjectId(n.externalUserId);
    return this.repo.create(data);
  }
  inbox(q: { communityId: string; userId?: string; externalUserId?: string; limit?: number; skip?: number; unreadOnly?: boolean; }) {
    const f: any = { communityId: new Types.ObjectId(q.communityId) };
    if (q.userId) f.userId = new Types.ObjectId(q.userId);
    if (q.externalUserId) f.externalUserId = new Types.ObjectId(q.externalUserId);
    if (q.unreadOnly) f.read = false;
    return this.repo.list(f, q.limit ?? 50, q.skip ?? 0);
  }
  markRead(id: string) { return this.repo.markRead(id); }
  markAllRead(q: { communityId: string; userId?: string; externalUserId?: string; }) {
    const f: any = { communityId: new Types.ObjectId(q.communityId) };
    if (q.userId) f.userId = new Types.ObjectId(q.userId);
    if (q.externalUserId) f.externalUserId = new Types.ObjectId(q.externalUserId);
    return this.repo.markAllRead(f);
  }
}

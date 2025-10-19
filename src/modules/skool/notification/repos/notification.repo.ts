// repos/notification.repo.ts
import { InjectModel } from '@nestjs/mongoose'; import { FilterQuery, Model } from 'mongoose';
import { SkoolNotification, SkoolNotificationDocument } from '../schemas/notification.schema';
export class NotificationRepo {
  constructor(@InjectModel(SkoolNotification.name) private model: Model<SkoolNotificationDocument>) {}
  create(data: Partial<SkoolNotification>) { return this.model.create(data); }
  list(filter: FilterQuery<SkoolNotification>, limit=50, skip=0) {
    return this.model.find(filter).sort({ createdAt: -1 }).limit(limit).skip(skip).lean();
  }
  markRead(id: string) { return this.model.findByIdAndUpdate(id, { read: true }, { new: true }).lean(); }
  markAllRead(filter: FilterQuery<SkoolNotification>) { return this.model.updateMany(filter, { $set: { read: true } }); }
}

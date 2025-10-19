// repos/metrics.repo.ts
import { InjectModel } from '@nestjs/mongoose'; import { FilterQuery, Model } from 'mongoose';
import { SkoolMetricEvent, SkoolMetricEventDocument } from '../schemas/metrics.schema';
export class MetricsRepo {
  constructor(@InjectModel(SkoolMetricEvent.name) private model: Model<SkoolMetricEventDocument>) {}
  create(data: Partial<SkoolMetricEvent>) { return this.model.create(data); }
  list(filter: FilterQuery<SkoolMetricEvent>, limit=100, skip=0) {
    return this.model.find(filter).sort({ createdAt: -1 }).limit(limit).skip(skip).lean();
  }
  aggDaily(communityId: string, type?: string, from?: Date, to?: Date) {
    const match: any = { communityId: new (require('mongoose')).Types.ObjectId(communityId) };
    if (type) match.type = type; if (from || to) match.createdAt = {};
    if (from) match.createdAt.$gte = from; if (to) match.createdAt.$lte = to;
    return this.model.aggregate([
      { $match: match },
      { $group: { _id: { d: { $dateToString: { date: '$createdAt', format: '%Y-%m-%d' } }, type: '$type' }, count: { $sum: 1 } } },
      { $sort: { '_id.d': 1 } },
    ]);
  }
}

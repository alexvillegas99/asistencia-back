// repos/moderation.repo.ts
import { InjectModel } from '@nestjs/mongoose'; import { FilterQuery, Model } from 'mongoose';
import { SkoolReport, SkoolReportDocument } from '../schemas/moderation.schema';
export class ModerationRepo {
  constructor(@InjectModel(SkoolReport.name) private model: Model<SkoolReportDocument>) {}
  create(data: Partial<SkoolReport>) { return this.model.create(data); }
  list(filter: FilterQuery<SkoolReport>, limit=50, skip=0) { return this.model.find(filter).sort({ createdAt: -1 }).limit(limit).skip(skip).lean(); }
  updateById(id: string, update: Partial<SkoolReport>) { return this.model.findByIdAndUpdate(id, update, { new: true }).lean(); }
  findById(id: string) { return this.model.findById(id).lean(); }
}

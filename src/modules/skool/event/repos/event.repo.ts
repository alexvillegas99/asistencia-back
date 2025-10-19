// repos/event.repo.ts
import { InjectModel } from '@nestjs/mongoose'; import { Model, FilterQuery } from 'mongoose';
import { SkoolEvent, SkoolEventDocument } from '../schemas/event.schema';
export class EventRepo {
  constructor(@InjectModel(SkoolEvent.name) private model: Model<SkoolEventDocument>) {}
  create(data: Partial<SkoolEvent>) { return this.model.create(data); }
  findById(id: string) { return this.model.findById(id).lean(); }
  list(filter: FilterQuery<SkoolEvent>, limit=50, skip=0) {
    return this.model.find(filter).sort({ startsAt: 1 }).limit(limit).skip(skip).lean();
  }
  updateById(id: string, update: Partial<SkoolEvent>) { return this.model.findByIdAndUpdate(id, update, { new: true }).lean(); }
  deleteById(id: string) { return this.model.findByIdAndDelete(id).lean(); }
}

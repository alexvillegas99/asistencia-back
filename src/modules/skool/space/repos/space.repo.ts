// repos/space.repo.ts
import { InjectModel } from '@nestjs/mongoose'; import { FilterQuery, Model, UpdateQuery } from 'mongoose';
import { SkoolSpace, SkoolSpaceDocument } from '../schemas/space.schema';
export class SpaceRepo {
  constructor(@InjectModel(SkoolSpace.name) private model: Model<SkoolSpaceDocument>) {}
  create(data: Partial<SkoolSpace>) { return this.model.create(data); }
  findById(id: string) { return this.model.findById(id).lean(); }
  findOne(filter: FilterQuery<SkoolSpace>) { return this.model.findOne(filter).lean(); }
  list(filter: FilterQuery<SkoolSpace>, limit=100, skip=0) {
    return this.model.find(filter).sort({ sortIndex: 1, createdAt: -1 }).limit(limit).skip(skip).lean();
  }
  updateById(id: string, update: UpdateQuery<SkoolSpace>) { return this.model.findByIdAndUpdate(id, update, { new: true }).lean(); }
  deleteById(id: string) { return this.model.findByIdAndDelete(id).lean(); }
}

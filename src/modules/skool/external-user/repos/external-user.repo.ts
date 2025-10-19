// src/modules/skool/external-user/repos/external-user.repo.ts
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, UpdateQuery } from 'mongoose';
import { ExternalUser, ExternalUserDocument } from '../schemas/external-user.schema';

export class ExternalUserRepo {
  constructor(
    @InjectModel(ExternalUser.name)
    private readonly model: Model<ExternalUserDocument>,
  ) {}

  create(data: Partial<ExternalUser>) {
    return this.model.create(data);
  }

  findById(id: string) {
    return this.model.findById(id).lean();
  }

  findOne(filter: FilterQuery<ExternalUser>) {
    return this.model.findOne(filter).lean();
  }

  findMany(filter: FilterQuery<ExternalUser>, limit = 50, skip = 0) {
    return this.model.find(filter).sort({ createdAt: -1 }).limit(limit).skip(skip).lean();
  }

  updateById(id: string, update: UpdateQuery<ExternalUser>) {
    return this.model.findByIdAndUpdate(id, update, { new: true }).lean();
  }

  deleteById(id: string) {
    return this.model.findByIdAndDelete(id).lean();
  }
}

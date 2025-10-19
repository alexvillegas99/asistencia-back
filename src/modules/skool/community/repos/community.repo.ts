// src/modules/skool/community/repos/community.repo.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { SkoolCommunity, SkoolCommunityDocument } from '../schemas/community.schema';

const POPULATE = [
  { path: 'avatarMediaId', select: 'url kind mimeType width height' },
  { path: 'bannerMediaId', select: 'url kind mimeType width height' },
];

@Injectable()
export class CommunityRepo {
  constructor(
    @InjectModel(SkoolCommunity.name)
    private readonly model: Model<SkoolCommunityDocument>,
  ) {}

  async create(data: Partial<SkoolCommunity>) {
    const doc = await this.model.create(data);
    return (await doc.populate(POPULATE)).toObject();
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.model.findById(id).populate(POPULATE).lean();
  }

  async findOne(filter: FilterQuery<SkoolCommunity>) {
    return this.model.findOne(filter).populate(POPULATE).lean();
  }

  async list(filter: FilterQuery<SkoolCommunity>, limit = 50, skip = 0) {
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate(POPULATE).lean(),
      this.model.countDocuments(filter),
    ]);
    return { items, total };
  }

  async updateById(id: string, upd: Partial<SkoolCommunity>) {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.model.findByIdAndUpdate(id, { $set: upd }, { new: true }).populate(POPULATE).lean();
  }

  async deleteById(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.model.findByIdAndDelete(id).lean();
  }
}

// src/modules/skool/post/repos/post.repo.ts
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, UpdateQuery, Types } from 'mongoose';
import { SkoolPost, SkoolPostDocument } from '../schemas/post.schema';

export class PostRepo {
  constructor(
    @InjectModel(SkoolPost.name) private readonly model: Model<SkoolPostDocument>,
  ) {}

  create(data: Partial<SkoolPost>) { return this.model.create(data); }
  findById(id: string) { return this.model.findById(id).lean(); }
  list(filter: FilterQuery<SkoolPost>, limit=50, skip=0) {
    return this.model.find(filter).sort({ pinned: -1, createdAt: -1 }).limit(limit).skip(skip).lean();
  }
  updateById(id: string, update: UpdateQuery<SkoolPost>) {
    return this.model.findByIdAndUpdate(id, update, { new: true }).lean();
  }
  deleteById(id: string) { return this.model.findByIdAndDelete(id).lean(); }

  isAuthor(id: string, userId?: string, externalId?: string) {
    const filter: any = { _id: new Types.ObjectId(id) };
    if (userId) filter.authorId = new Types.ObjectId(userId);
    if (externalId) filter.externalAuthorId = new Types.ObjectId(externalId);
    return this.model.exists(filter);
  }
}

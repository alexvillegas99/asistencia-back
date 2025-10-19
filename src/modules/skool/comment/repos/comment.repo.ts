// repos/comment.repo.ts
import { InjectModel } from '@nestjs/mongoose'; import { Model, FilterQuery } from 'mongoose';
import { SkoolComment, SkoolCommentDocument } from '../schemas/comment.schema';
export class CommentRepo {
  constructor(@InjectModel(SkoolComment.name) private model: Model<SkoolCommentDocument>) {}
  create(data: Partial<SkoolComment>) { return this.model.create(data); }
  findById(id: string) { return this.model.findById(id).lean(); }
  list(filter: FilterQuery<SkoolComment>, limit=100, skip=0) {
    return this.model.find(filter).sort({ createdAt: 1 }).limit(limit).skip(skip).lean();
  }
  updateById(id: string, update: Partial<SkoolComment>) {
    return this.model.findByIdAndUpdate(id, update, { new: true }).lean();
  }
  deleteById(id: string) { return this.model.findByIdAndDelete(id).lean(); }
}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { SkoolSection, SkoolSectionDocument } from '../schemas/section.schema';

@Injectable()
export class SectionRepo {
  constructor(
    @InjectModel(SkoolSection.name)
    private readonly model: Model<SkoolSectionDocument>,
  ) {}

  asObjectId(id: string | Types.ObjectId) {
    return typeof id === 'string' ? new Types.ObjectId(id) : id;
  }

  async create(data: Partial<SkoolSection>) {
    return this.model.create(data);
  }

  async findById(id: string) {
    return this.model.findById(this.asObjectId(id)).lean();
  }

  async findOne(filter: FilterQuery<SkoolSection>) {
    return this.model.findOne(filter).lean();
  }

  async findByCourse(courseId: string) {
    return this.model.find({ courseId: this.asObjectId(courseId) })
      .sort({ sortIndex: 1, createdAt: 1 })
      .lean();
  }

  async lastIndex(courseId: string) {
    const last = await this.model.find({ courseId: this.asObjectId(courseId) })
      .sort({ sortIndex: -1 })
      .limit(1)
      .lean();
    return last.length ? (last[0].sortIndex ?? 0) : -1;
  }

  async countByCourse(courseId: string) {
    return this.model.countDocuments({ courseId: this.asObjectId(courseId) });
  }

  async updateById(id: string, set: Partial<SkoolSection>) {
    return this.model.findByIdAndUpdate(this.asObjectId(id), { $set: set }, { new: true });
  }

  async deleteById(id: string) {
    return this.model.deleteOne({ _id: this.asObjectId(id) });
  }

  async bulkReorder(courseId: string, ids: string[]) {
    const cId = this.asObjectId(courseId);
    const ops = ids.map((id, idx) => ({
      updateOne: {
        filter: { _id: this.asObjectId(id), courseId: cId },
        update: { $set: { sortIndex: idx } },
      },
    }));
    if (!ops.length) return;
    await this.model.bulkWrite(ops);
  }
}

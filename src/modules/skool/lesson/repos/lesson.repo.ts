import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { SkoolLesson, SkoolLessonDocument } from '../schemas/lesson.schema';
const POPULATE = [
  { path: 'videoMediaId', select: 'url kind mimeType width height s3Key' },
   { path: 'attachments',  select: 'url filename mimeType size s3Key kind originalName' },
];
@Injectable()
export class LessonRepo {
  constructor(
    @InjectModel(SkoolLesson.name)
    private readonly model: Model<SkoolLessonDocument>,
  ) {}

  asObjectId(id: string | Types.ObjectId) {
    return typeof id === 'string' ? new Types.ObjectId(id) : id;
  }

  async create(data: Partial<SkoolLesson>) {
    return this.model.create(data);
  }

  async findById(id: string) {
    return this.model.findById(this.asObjectId(id)).populate(POPULATE).lean();
  }

  async findOne(filter: FilterQuery<SkoolLesson>) {
    return this.model.findOne(filter).populate(POPULATE).lean();
  }

  
  async findBySection(sectionId: string) {
    console.log('🔍 [LessonRepo] findBySection', sectionId);
    return this.model
      .find({ sectionId: this.asObjectId(sectionId) })
      .populate(POPULATE)
      .sort({ sortIndex: 1, createdAt: 1 })
      .lean();
  }

  async findByCourseGrouped(courseId: string) {
    return this.model.aggregate([
      { $match: { courseId: this.asObjectId(courseId) } },
      { $sort: { sectionId: 1, sortIndex: 1, createdAt: 1 } },
      { $group: { _id: '$sectionId', lessons: { $push: '$$ROOT' } } },
    ]);
  }

  async countBySection(sectionId: string) {
    return this.model.countDocuments({ sectionId: this.asObjectId(sectionId) });
  }

  async lastIndex(courseId: string, sectionId: string) {
    const last = await this.model
      .find({
        courseId: this.asObjectId(courseId),
        sectionId: this.asObjectId(sectionId),
      })
      .sort({ sortIndex: -1 })
      .limit(1)
      .lean();
    return last.length ? (last[0].sortIndex ?? 0) : -1;
  }

  async updateById(id: string, set: Partial<SkoolLesson>) {
    return this.model.findByIdAndUpdate(
      this.asObjectId(id),
      { $set: set },
      { new: true },
    );
  }

  async deleteById(id: string) {
    return this.model.deleteOne({ _id: this.asObjectId(id) });
  }

  async bulkReorder(sectionId: string, ids: string[]) {
    const sId = this.asObjectId(sectionId);
    const ops = ids.map((id, idx) => ({
      updateOne: {
        filter: { _id: this.asObjectId(id), sectionId: sId },
        update: { $set: { sortIndex: idx } },
      },
    }));
    if (!ops.length) return;
    await this.model.bulkWrite(ops);
  }

   async addAttachment(lessonId: string, mediaId: string) {
    return this.model.findByIdAndUpdate(
      this.asObjectId(lessonId),
      { $addToSet: { attachments: this.asObjectId(mediaId) } },
      { new: true }
    ).populate(POPULATE).lean();
  }

  async removeAttachment(lessonId: string, mediaId: string) {
    return this.model.findByIdAndUpdate(
      this.asObjectId(lessonId),
      { $pull: { attachments: this.asObjectId(mediaId) } },
      { new: true }
    ).populate(POPULATE).lean();
  }
}

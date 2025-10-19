// src/modules/skool/course/repos/course.repo.ts
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, UpdateQuery } from 'mongoose';
import { SkoolCourse, SkoolCourseDocument } from '../schemas/course.schema';

export class CourseRepo {
 constructor(
    @InjectModel(SkoolCourse.name) private readonly model: Model<SkoolCourseDocument>,
  ) {}

  create(data: Partial<SkoolCourse>) {
    return this.model.create(data);
  }

  findById(id: string) {
    return this.model.findById(id).lean();
  }

  findOne(filter: FilterQuery<SkoolCourse>) {
    return this.model.findOne(filter).lean();
  }

 list(filter: FilterQuery<SkoolCourse>, limit = 50, skip = 0) {
    return this.model
      .find(filter)
      .select({
        title: 1,
        slug: 1,
        category: 1,
        description: 1,
        visibility: 1,
        status: 1,
        sortIndex: 1,
        communityId: 1,
        coverMediaId: 1,
        createdAt: 1,
        updatedAt: 1,
      })
      .sort({ sortIndex: 1, createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .populate([
        {
          path: 'coverMediaId',
          select: { url: 1, mimeType: 1, kind: 1, width: 1, height: 1 },
        },
         { path: 'communityId',  select: { name: 1, slug: 1 } },
        // 👉 Si luego agregas ref en communityId, aquí añades otro populate
        // { path: 'communityId', select: { name: 1, slug: 1 } },
      ])
      .lean()
      .exec();
  }

  // Detalle con populate
  findByIdPopulated(id: string) {
    return this.model
      .findById(id)
      .select({
        title: 1,
        slug: 1,
        category: 1,
        description: 1,
        visibility: 1,
        status: 1,
        sortIndex: 1,
        communityId: 1,
        coverMediaId: 1,
        createdAt: 1,
        updatedAt: 1,
      })
      .populate([
        {
          path: 'coverMediaId',
          select: { url: 1, mimeType: 1, kind: 1, width: 1, height: 1 },
        },
        // { path: 'communityId', select: { name: 1, slug: 1 } },
      ])
      .lean()
      .exec();
  }

  // (si quieres la versión sin populate)
  find(filter: FilterQuery<SkoolCourse>) {
    return this.model.findOne(filter).lean().exec();
  }

  updateById(id: string, update: UpdateQuery<SkoolCourse>) {
    return this.model.findByIdAndUpdate(id, update, { new: true }).lean();
  }

  deleteById(id: string) {
    return this.model.findByIdAndDelete(id).lean();
  }
}

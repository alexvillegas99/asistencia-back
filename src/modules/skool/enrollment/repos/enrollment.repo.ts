// src/modules/skool/enrollment/repos/enrollment.repo.ts
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, UpdateQuery } from 'mongoose';
import { Enrollment, EnrollmentDocument } from '../schemas/enrollment.schema';

export class EnrollmentRepo {
  constructor(
    @InjectModel(Enrollment.name) private readonly model: Model<EnrollmentDocument>,
  ) {}

  create(data: Partial<Enrollment>) {
    return this.model.create(data);
  }

  findById(id: string) {
    return this.model.findById(id).lean();
  }

  findOne(filter: FilterQuery<Enrollment>) {
    return this.model.findOne(filter).lean();
  }

  list(filter: FilterQuery<Enrollment>, limit = 50, skip = 0) {
    return this.model.find(filter).sort({ createdAt: -1 }).limit(limit).skip(skip).lean();
  }

  updateById(id: string, update: UpdateQuery<Enrollment>) {
    return this.model.findByIdAndUpdate(id, update, { new: true }).lean();
  }

  deleteById(id: string) {
    return this.model.findByIdAndDelete(id).lean();
  }
}

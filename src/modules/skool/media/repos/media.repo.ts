// src/modules/media/repos/media.repo.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Media, MediaDocument } from '../schemas/media.schema';

@Injectable()
export class MediaRepo {
  constructor(@InjectModel(Media.name) private model: Model<MediaDocument>) {}

  create(data: Partial<Media>) {
    return this.model.create(data);
  }

  findById(id: string) {
    return this.model.findById(new Types.ObjectId(id)).lean();
  }

  updateById(id: string, data: Partial<Media>) {
    return this.model.findByIdAndUpdate(new Types.ObjectId(id), data, { new: true }).lean();
  }

  findOne(filter: Partial<Media>) {
    return this.model.findOne(filter as any).lean();
  }
}

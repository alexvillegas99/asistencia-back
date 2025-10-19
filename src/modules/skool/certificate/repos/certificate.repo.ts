// src/modules/skool/certificate/repos/certificate.repo.ts
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, UpdateQuery } from 'mongoose';
import { SkoolCertificate, SkoolCertificateDocument } from '../schemas/certificate.schema';

export class CertificateRepo {
  constructor(
    @InjectModel(SkoolCertificate.name) private readonly model: Model<SkoolCertificateDocument>,
  ) {}

  create(data: Partial<SkoolCertificate>) { return this.model.create(data); }
  findById(id: string) { return this.model.findById(id).lean(); }
  findOne(filter: FilterQuery<SkoolCertificate>) { return this.model.findOne(filter).lean(); }
  list(filter: FilterQuery<SkoolCertificate>, limit=50, skip=0) {
    return this.model.find(filter).sort({ createdAt: -1 }).limit(limit).skip(skip).lean();
  }
  updateById(id: string, update: UpdateQuery<SkoolCertificate>) {
    return this.model.findByIdAndUpdate(id, update, { new: true }).lean();
  }
}

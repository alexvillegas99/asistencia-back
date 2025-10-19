// src/modules/skool/membership/repos/membership.repo.ts
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, UpdateQuery, Types } from 'mongoose';
import { SkoolMembership, SkoolMembershipDocument } from '../schemas/membership.schema';

export class MembershipRepo {
  constructor(
    @InjectModel(SkoolMembership.name) private readonly model: Model<SkoolMembershipDocument>,
  ) {}

  create(data: Partial<SkoolMembership>) { return this.model.create(data); }
  findById(id: string) { return this.model.findById(id).lean(); }
  findOne(filter: FilterQuery<SkoolMembership>) { return this.model.findOne(filter).lean(); }
  list(filter: FilterQuery<SkoolMembership>, limit=50, skip=0) {
    return this.model.find(filter).sort({ createdAt: -1 }).limit(limit).skip(skip).lean();
  }
  updateById(id: string, update: UpdateQuery<SkoolMembership>) {
    return this.model.findByIdAndUpdate(id, update, { new: true }).lean();
  }
  deleteById(id: string) { return this.model.findByIdAndDelete(id).lean(); }

  findByActor(communityId: string, actor: { userId?: string; externalUserId?: string }) {
    const f: any = { communityId: new Types.ObjectId(communityId) };
    if (actor.userId) f.userId = new Types.ObjectId(actor.userId);
    if (actor.externalUserId) f.externalUserId = new Types.ObjectId(actor.externalUserId);
    return this.model.findOne(f).lean();
  }
}

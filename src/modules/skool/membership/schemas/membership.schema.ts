// src/modules/skool/membership/schemas/membership.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SkoolMembershipDocument = HydratedDocument<SkoolMembership>;
type Role = 'owner'|'admin'|'mod'|'member';
type Status = 'invited'|'active'|'banned';

@Schema({ collection: 'skool_memberships', timestamps: true })
export class SkoolMembership {
  @Prop({ type: Types.ObjectId, ref: 'SkoolCommunity', required: true, index: true })
  communityId: Types.ObjectId;

  // uno de los dos (interno o externo)
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  userId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ExternalUser', index: true })
  externalUserId?: Types.ObjectId;

  @Prop({ enum: ['owner','admin','mod','member'], default: 'member', index: true })
  role: Role;

  @Prop({ enum: ['invited','active','banned'], default: 'active', index: true })
  status: Status;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  invitedById?: Types.ObjectId;

  @Prop({ type: Date })
  joinedAt?: Date;

  @Prop({ type: Object, default: {} })
  meta?: Record<string, any>;
}

export const SkoolMembershipSchema = SchemaFactory.createForClass(SkoolMembership);

// Unicidad por comunidad + actor
SkoolMembershipSchema.index(
  { communityId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $exists: true } } },
);
SkoolMembershipSchema.index(
  { communityId: 1, externalUserId: 1 },
  { unique: true, partialFilterExpression: { externalUserId: { $exists: true } } },
);

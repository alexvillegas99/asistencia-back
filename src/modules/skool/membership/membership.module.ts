// src/modules/skool/membership/membership.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SkoolMembership, SkoolMembershipSchema } from './schemas/membership.schema';
import { MembershipRepo } from './repos/membership.repo';
import { MembershipService } from './membership.service';
import { MembershipController } from './membership.controller';

@Module({
  imports: [ MongooseModule.forFeature([{ name: SkoolMembership.name, schema: SkoolMembershipSchema }]) ],
  controllers: [MembershipController],
  providers: [MembershipRepo, MembershipService],
  exports: [MembershipService, MembershipRepo],
})
export class MembershipModule {}

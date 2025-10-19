// src/modules/skool/community/community.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SkoolCommunity, SkoolCommunitySchema } from './schemas/community.schema';
import { CommunityRepo } from './repos/community.repo';
import { CommunityService } from './community.service';
import { CommunityController } from './community.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SkoolCommunity.name, schema: SkoolCommunitySchema }]),
  ],
  controllers: [CommunityController],
  providers: [CommunityRepo, CommunityService],
  exports: [CommunityService, CommunityRepo],
})
export class CommunityModule {}

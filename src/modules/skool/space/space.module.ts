// space.module.ts
import { Module } from '@nestjs/common'; import { MongooseModule } from '@nestjs/mongoose';
import { SkoolSpace, SkoolSpaceSchema } from './schemas/space.schema';
import { SpaceRepo } from './repos/space.repo'; import { SpaceService } from './space.service'; import { SpaceController } from './space.controller';
@Module({
  imports: [ MongooseModule.forFeature([{ name: SkoolSpace.name, schema: SkoolSpaceSchema }]) ],
  controllers: [SpaceController],
  providers: [SpaceRepo, SpaceService],
  exports: [SpaceService, SpaceRepo],
}) export class SpaceModule {}

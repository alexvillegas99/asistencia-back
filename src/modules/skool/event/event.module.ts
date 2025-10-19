// event.module.ts
import { Module } from '@nestjs/common'; import { MongooseModule } from '@nestjs/mongoose';
import { SkoolEvent, SkoolEventSchema } from './schemas/event.schema';
import { EventRepo } from './repos/event.repo'; import { EventService } from './event.service'; import { EventController } from './event.controller';
@Module({
  imports: [ MongooseModule.forFeature([{ name: SkoolEvent.name, schema: SkoolEventSchema }]) ],
  controllers: [EventController],
  providers: [EventRepo, EventService],
  exports: [EventService, EventRepo],
}) export class EventModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SkoolLesson, SkoolLessonSchema } from './schemas/lesson.schema';
import { LessonService } from './lesson.service';
import { LessonController } from './lesson.controller';
import { LessonRepo } from './repos/lesson.repo';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SkoolLesson.name, schema: SkoolLessonSchema }]),
  ],
  controllers: [LessonController],
  providers: [LessonService, LessonRepo],
  exports: [LessonService, LessonRepo],
})
export class LessonModule {}

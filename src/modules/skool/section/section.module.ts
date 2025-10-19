import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SkoolSection, SkoolSectionSchema } from './schemas/section.schema';
import { SectionService } from './section.service';
import { SectionController } from './section.controller';
import { SectionRepo } from './repos/section.repo';
import { LessonModule } from '../lesson/lesson.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SkoolSection.name, schema: SkoolSectionSchema }]),
    LessonModule,
  ],
  controllers: [SectionController],
  providers: [SectionService, SectionRepo],
  exports: [SectionService, SectionRepo],
})
export class SectionModule {}

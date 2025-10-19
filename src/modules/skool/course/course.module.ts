import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SkoolCourse, SkoolCourseSchema } from './schemas/course.schema';
import { CourseRepo } from './repos/course.repo';
import { CourseService } from './course.service';
import { CourseController } from './course.controller';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SkoolCourse.name, schema: SkoolCourseSchema }]),
    MediaModule
  ],
  controllers: [CourseController],
  providers: [CourseRepo, CourseService],
  exports: [CourseService, CourseRepo],
})
export class CourseModule {}

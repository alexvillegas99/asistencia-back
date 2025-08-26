import { Module } from '@nestjs/common';
import { MoodleService } from './moodle.service';
import { MoodleController } from './moodle.controller';

@Module({
  imports:  [],
  controllers: [MoodleController],
  providers: [MoodleService],
})
export class MoodleModule {}

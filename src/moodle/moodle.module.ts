import { Module } from '@nestjs/common';
import { MoodleService } from './moodle.service';
import { MoodleController } from './moodle.controller';
import { AsistentesModule } from 'src/asistentes/asistentes.module';
import { ReportsService } from 'src/common/services/reports.service';

@Module({
  imports: [AsistentesModule],
  controllers: [MoodleController],
  providers: [MoodleService, ReportsService],
})
export class MoodleModule {}

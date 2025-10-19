// moderation.module.ts
import { Module } from '@nestjs/common'; import { MongooseModule } from '@nestjs/mongoose';
import { SkoolReport, SkoolReportSchema } from './schemas/moderation.schema';
import { ModerationRepo } from './repos/moderation.repo'; import { ModerationService } from './moderation.service'; import { ModerationController } from './moderation.controller';
@Module({
  imports: [ MongooseModule.forFeature([{ name: SkoolReport.name, schema: SkoolReportSchema }]) ],
  controllers: [ModerationController],
  providers: [ModerationRepo, ModerationService],
  exports: [ModerationService, ModerationRepo],
}) export class ModerationModule {}

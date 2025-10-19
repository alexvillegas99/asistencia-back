// metrics.module.ts
import { Module } from '@nestjs/common'; import { MongooseModule } from '@nestjs/mongoose';
import { SkoolMetricEvent, SkoolMetricEventSchema } from './schemas/metrics.schema';
import { MetricsRepo } from './repos/metrics.repo'; import { MetricsService } from './metrics.service'; import { MetricsController } from './metrics.controller';
@Module({
  imports: [ MongooseModule.forFeature([{ name: SkoolMetricEvent.name, schema: SkoolMetricEventSchema }]) ],
  controllers: [MetricsController],
  providers: [MetricsRepo, MetricsService],
  exports: [MetricsService, MetricsRepo],
}) export class MetricsModule {}

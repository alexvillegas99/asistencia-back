// notification.module.ts
import { Module } from '@nestjs/common'; import { MongooseModule } from '@nestjs/mongoose';
import { SkoolNotification, SkoolNotificationSchema } from './schemas/notification.schema';
import { NotificationRepo } from './repos/notification.repo'; import { NotificationService } from './notification.service'; import { NotificationController } from './notification.controller';
@Module({
  imports: [ MongooseModule.forFeature([{ name: SkoolNotification.name, schema: SkoolNotificationSchema }]) ],
  controllers: [NotificationController],
  providers: [NotificationRepo, NotificationService],
  exports: [NotificationService, NotificationRepo],
}) export class NotificationModule {}

import { Module } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { NotificacionesController } from './notificaciones.controller';
import { AmazonS3Module } from 'src/amazon-s3/amazon-s3.module';
import { MongooseModule } from '@nestjs/mongoose';
import {
  NotificacioneModelName,
  NotificacioneSchema,
} from './entities/notificacione.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NotificacioneModelName, schema: NotificacioneSchema },
    ]),
    AmazonS3Module,
  ],
  controllers: [NotificacionesController],
  providers: [NotificacionesService],
})
export class NotificacionesModule {}

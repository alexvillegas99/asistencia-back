// src/modules/media/media.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { AmazonS3Service } from 'src/amazon-s3/amazon-s3.service';
import { Media, MediaSchema } from './schemas/media.schema';
import { MediaRepo } from './repos/media.repo';

@Module({
  imports: [
    ConfigModule,                                    // ✅ módulos van en imports
    MongooseModule.forFeature([{ name: Media.name, schema: MediaSchema }]),
  ],
  controllers: [MediaController],
  providers: [MediaService, AmazonS3Service, MediaRepo], // ✅ servicios aquí
  exports: [MediaService],                                 // exporta si otros módulos lo usan
})
export class MediaModule {}

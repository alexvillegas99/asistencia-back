import { Module } from '@nestjs/common';
import { CampanasService } from './campanas.service';
import { CampanasController } from './campanas.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Campaña, CampañaSchema } from './entities/campana.entity';
import { AmazonS3Module } from 'src/amazon-s3/amazon-s3.module';

@Module({
  controllers: [CampanasController],
  providers: [CampanasService],
  imports: [
    MongooseModule.forFeature([{ name: Campaña.name, schema: CampañaSchema }]),
    AmazonS3Module
  ],
})
export class CampanasModule {}

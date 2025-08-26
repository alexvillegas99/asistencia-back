import { Global, Module } from '@nestjs/common';
import { AmazonS3Service } from './amazon-s3.service';
import { AmazonS3Controller } from './amazon-s3.controller';
@Global()
@Module({
  
  controllers: [AmazonS3Controller],
  providers: [AmazonS3Service],
  exports: [AmazonS3Service],
})
export class AmazonS3Module {}

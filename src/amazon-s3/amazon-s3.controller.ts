import { Controller } from '@nestjs/common';
import { AmazonS3Service } from './amazon-s3.service';

@Controller('amazon-s3')
export class AmazonS3Controller {
  constructor(private readonly amazonS3Service: AmazonS3Service) {}
}

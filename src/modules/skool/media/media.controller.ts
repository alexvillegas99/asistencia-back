// src/modules/media/media.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { MediaService } from './media.service';
import { CreateMediaBase64Dto } from './dto/create-media-base64.dto';
import { RequestUploadDto } from './dto/request-upload.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post()
  createBase64(@Body() dto: CreateMediaBase64Dto) {
    return this.media.uploadBase64(dto);
  }

  @Post('request-upload')
  requestUpload(@Body() dto: RequestUploadDto) {
    return this.media.requestUpload(dto);
  }

  @Post('complete')
  complete(@Body() dto: CompleteUploadDto) {
    return this.media.completeUpload(dto);
  }
}

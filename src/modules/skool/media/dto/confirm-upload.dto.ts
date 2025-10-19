// src/modules/skool/media/dto/confirm-upload.dto.ts
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class ConfirmUploadDto {
  @IsString()
  key: string;

  @IsString()
  bucket: string;

  @IsString()
  contentType: string;

  @IsNumber()
  size: number;

  @IsIn(['avatar','post','comment','lesson','event','attachment','certificate','raw'])
  scope: 'avatar'|'post'|'comment'|'lesson'|'event'|'attachment'|'certificate'|'raw';

  @IsOptional() @IsString()
  communityId?: string;

  @IsOptional() @IsString()
  entityId?: string;
}

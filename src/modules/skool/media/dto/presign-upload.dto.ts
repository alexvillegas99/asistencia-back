// src/modules/skool/media/dto/presign-upload.dto.ts
import { IsIn, IsOptional, IsString } from 'class-validator';

export class PresignUploadDto {
  @IsString()
  contentType: string;

  @IsIn(['avatar','post','comment','lesson','event','attachment','certificate','raw'])
  scope: 'avatar'|'post'|'comment'|'lesson'|'event'|'attachment'|'certificate'|'raw';

  @IsOptional() @IsString()
  communityId?: string;

  @IsOptional() @IsString()
  entityId?: string;

  @IsOptional() @IsString()
  originalName?: string;
}

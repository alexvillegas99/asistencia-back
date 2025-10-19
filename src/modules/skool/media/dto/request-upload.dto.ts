// src/modules/media/dto/request-upload.dto.ts
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class RequestUploadDto {
  @IsIn(['image','video','file'])
  kind: 'image' | 'video' | 'file';

  @IsString() @IsNotEmpty()
  contentType: string;   // ej: "video/mp4"

  @IsNumber() @Min(1) @Max(5 * 1024 * 1024 * 1024) // 5GB
  size: number;

  @IsString() @IsNotEmpty()
  filename: string;

  // para construir la key con más contexto (opcional)
  @IsOptional() @IsString()
  communityId?: string; 
  @IsOptional() @IsString()
  entityId?: string;

  // dónde quieres ponerlo (scope del key builder)
  @IsIn(['avatar','post','comment','lesson','event','attachment','certificate','raw'])
  scope: 'avatar' | 'post' | 'comment' | 'lesson' | 'event' | 'attachment' | 'certificate' | 'raw';
}

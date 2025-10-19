// src/modules/media/media.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { AmazonS3Service } from 'src/amazon-s3/amazon-s3.service';
import { CreateMediaBase64Dto } from './dto/create-media-base64.dto';
import { RequestUploadDto } from './dto/request-upload.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { MediaRepo } from './repos/media.repo';

@Injectable()
export class MediaService {
  constructor(
    private readonly s3: AmazonS3Service,
    private readonly repo: MediaRepo,
  ) {}

  // A) Imágenes pequeñas en base64 → S3 + DB (ready)
  async uploadBase64(dto: CreateMediaBase64Dto) {
    const { key, imageUrl, contentType, size } = await this.s3.uploadBase64({
      image: dto.image,
      route: dto.route,
      contentType: dto.contentType,
    });

    const doc = await this.repo.create({
      kind: 'image',
      mimeType: contentType,
      size,
      s3Key: key,
      url: imageUrl,
      status: 'ready',
      originalName: undefined,
      communityId: undefined,
      ownerId: undefined,
      variants: [],
    });

    return { mediaId: String(doc._id), key, url: imageUrl, mimeType: contentType, size, status: 'ready' };
  }

  // B) Solicitar URL firmada (videos/archivos grandes) → crea media: pending
async requestUpload(dto: RequestUploadDto) {
  console.log('📩 [MediaService] requestUpload recibido:', {
    kind: dto.kind,
    scope: dto.scope,
    contentType: dto.contentType,
    size: dto.size,
    filename: dto.filename,
  });

  // validaciones rápidas
  if (dto.kind === 'image' && !/^image\//.test(dto.contentType)) {
    throw new BadRequestException('contentType inválido para imagen');
  }
  if (dto.kind === 'video' && !/^video\//.test(dto.contentType)) {
    throw new BadRequestException('contentType inválido para video');
  }

  // pedir la URL firmada al servicio S3
  console.log('🪣 [MediaService] Generando presigned PUT...');
  const { key, url, bucket, contentType, publicUrl } = await this.s3.presignPut({
    contentType: dto.contentType,
    scope: dto.scope,
    communityId: dto.communityId,
    entityId: dto.entityId,
    originalName: dto.filename,
  });

  console.log('✅ [MediaService] presignPut ok:', {
    bucket,
    key,
    contentType,
    url: url?.slice(0, 100) + '...', // corta para no saturar logs
  });

  const media = await this.repo.create({
    kind: dto.kind,
    mimeType: contentType,
    size: dto.size,
    s3Key: key,
    url: undefined,
    status: 'pending',
    originalName: dto.filename,
    communityId: dto.communityId,
    ownerId: undefined,
    variants: [],
  });

  console.log('💾 [MediaService] Media guardado en DB:', {
    id: String(media._id),
    key,
    size: dto.size,
  });

  return {
    mediaId: String(media._id),
    key,
    uploadUrl: url,
    bucket,
    contentType,
    publicUrlHint: publicUrl,
    status: 'pending',
    size: dto.size,
  };
}


  // C) Completar: verificar existencia y marcar ready + url
  async completeUpload(dto: CompleteUploadDto) {
    const exists = await this.s3.verifyExists(dto.key);
    if (!exists) throw new BadRequestException('El objeto aún no está en S3');

    const url = this.s3.getPublicUrl(dto.key);

    // busca por key; si prefieres, pásame mediaId en el DTO
    const media = await this.repo.findOne({ s3Key: dto.key });
    if (!media) throw new BadRequestException('Media no encontrada para esa key');

    const updated = await this.repo.updateById(String(media._id), {
      status: 'ready',
      url,
    });

    return { ok: true, mediaId: String(updated!._id), key: dto.key, url, status: 'ready' };
  }
}

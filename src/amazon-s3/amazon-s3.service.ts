// src/amazon-s3/amazon-s3.service.ts
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand, // 👈 NUEVO (opcional)
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as mime from 'mime-types';
import axios from 'axios';

type BuildKeyInput = {
  scope: 'avatar' | 'post' | 'comment' | 'lesson' | 'event' | 'attachment' | 'certificate' | 'raw';
  communityId?: string;
  entityId?: string;   // postId, lessonId, etc.
  userId?: string;
  originalName?: string; // para inferir extensión
  extOverride?: string;  // si quieres forzar ext (ej: "png")
};

type PresignPutInput = {
  contentType: string;
  scope: BuildKeyInput['scope'];
  communityId?: string;
  entityId?: string;
  userId?: string;
  originalName?: string;
  extOverride?: string;
  expiresSec?: number; // default 300
};

type PresignPutOutput = {
  key: string;
  url: string;       // signed PUT url
  bucket: string;
  contentType: string;
  publicUrl: string; // URL pública una vez subido (CloudFront o S3)
};

type PresignGetInput = {
  key: string;
  expiresSec?: number; // default 300
};

@Injectable()
export class AmazonS3Service {
  private s3: S3Client;
  private bucketName: string;
  private regionName: string;
  private cloudfrontDomain?: string;                  // 👈 NUEVO: se lee de config
  private signedTtl: number;
  private logger = new Logger(AmazonS3Service.name);

  // 👇 Actualizado: lista clara y extensible
  private allowedMime = new Set([
    // imágenes
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
    // docs
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // video/audio
    'video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg',
  ]);

  // 👇 Límite para base64 (bytes reales del archivo)
  private base64MaxBytes = 8 * 1024 * 1024; // 8 MB (ideal solo imágenes)

  constructor(private readonly configService: ConfigService) {
    this.s3 = new S3Client({
      region: this.configService.get<string>('AWS_S3_BUCKET_REGION'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY')!,
      },
    });
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME')!;
    this.regionName = this.configService.get<string>('AWS_S3_BUCKET_REGION')!;
    this.signedTtl = Number(this.configService.get<string>('AWS_S3_SIGNED_URL_TTL') ?? 300);

    // 👇 NUEVO: soporta CDN (CloudFront) vía config
    this.cloudfrontDomain = this.configService.get<string>('AWS_CLOUDFRONT_DOMAIN') || undefined;
  }

  // ---------- KEY BUILDER ----------
  buildKey(input: BuildKeyInput): string {
    const uuid = uuidv4();
    const base = ['skool'];
    if (input.communityId) base.push(input.communityId);
    base.push(input.scope);

    if (input.entityId) base.push(input.entityId);
    if (input.userId && input.scope === 'avatar') base.push(input.userId);

    let ext = input.extOverride;
    if (!ext && input.originalName) {
      const guess = mime.extension(mime.lookup(input.originalName) || '') || undefined;
      if (guess) ext = guess;
    }
    const file = ext ? `${uuid}.${ext}` : uuid;
    base.push(file);

    return base.join('/').replace(/\s+/g, '');
  }

  // ---------- PRESIGNED PUT (subida directa desde el cliente) ----------
 async presignPut(input: PresignPutInput): Promise<PresignPutOutput> {
  console.log('📤 [S3Service] presignPut():', {
    scope: input.scope,
    contentType: input.contentType,
    communityId: input.communityId,
    entityId: input.entityId,
    originalName: input.originalName,
  });

  const { contentType } = input;
  if (!contentType || !this.allowedMime.has(contentType)) {
    console.error('❌ [S3Service] ContentType no permitido:', contentType);
    throw new BadRequestException(`ContentType no permitido: ${contentType}`);
  }

  const normalizedType = 
  contentType === 'video/quicktime' ? 'video/mp4' : contentType;

const ext = mime.extension(normalizedType) || input.extOverride;
  const key = this.buildKey({
    scope: input.scope,
    communityId: input.communityId,
    entityId: input.entityId,
    userId: input.userId,
    originalName: input.originalName,
    extOverride: ext,
  });

  console.log('🧩 [S3Service] buildKey() →', key);

  const cmd = new PutObjectCommand({
    Bucket: this.bucketName,
    Key: key,
    ContentType: contentType,
    // ACL: 'private'
  });

  const url = await getSignedUrl(this.s3, cmd, {
    expiresIn: input.expiresSec ?? this.signedTtl,
  });

  console.log('🔑 [S3Service] Signed URL generado:', {
    bucket: this.bucketName,
    expiresIn: input.expiresSec ?? this.signedTtl,
  });

  return { key, url, bucket: this.bucketName, contentType, publicUrl: this.getPublicUrl(key) };
}


  // ---------- PRESIGNED GET (descarga con tiempo) ----------
  async presignGet(input: PresignGetInput) {
    const cmd = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: input.key,
    });
    const url = await getSignedUrl(this.s3, cmd, {
      expiresIn: input.expiresSec ?? this.signedTtl,
    });
    return url;
  }

  // ---------- URL pública (CloudFront si existe, sino S3) ----------
  getPublicUrl(key: string) {
    if (this.cloudfrontDomain) {
      return `https://${this.cloudfrontDomain.replace(/\/+$/,'')}/${key.replace(/^\/+/,'')}`;
    }
    return `https://${this.bucketName}.s3.${this.regionName}.amazonaws.com/${key}`;
  }

  // ---------- SUBIDA BASE64 (para IMÁGENES pequeñas) ----------
  /**
   * Subir base64 solo para imágenes pequeñas (<= 8MB).
   * Si necesitas subir videos/archivos grandes: usa presignPut() y PUT directo a S3 desde el front.
   */
  async uploadBase64(body: { image: string; route: string; contentType?: string }) {
    try {
      // Permitir "data:*;base64,..." o base64 puro
      const isDataUrl = body.image.startsWith('data:');
      const base64 = isDataUrl ? body.image.split(',')[1] : body.image;

      const contentType =
        body.contentType ||
        (isDataUrl ? body.image.slice(5, body.image.indexOf(';')) : 'image/jpeg');

      // Solo permitir imágenes aquí (buena práctica)
      if (!/^image\//.test(contentType)) {
        throw new BadRequestException('uploadBase64 solo acepta imágenes. Usa presignPut para videos/archivos.');
      }
      if (!this.allowedMime.has(contentType)) {
        throw new BadRequestException(`ContentType no permitido: ${contentType}`);
      }

      const buffer = Buffer.from(base64, 'base64');
      const size = buffer.byteLength;
      if (size > this.base64MaxBytes) {
        throw new BadRequestException(`La imagen excede ${Math.round(this.base64MaxBytes/1024/1024)}MB. Usa subida con URL firmada.`);
      }

      const ext = mime.extension(contentType) || 'jpg';
      const key = `${body.route}/${uuidv4()}.${ext}`.replace(/\s+/g, '');

      const put = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });

      await this.s3.send(put);
      const imageUrl = this.getPublicUrl(key);
      return { key, imageUrl, bucket: this.bucketName, contentType, size };
    } catch (error: any) {
      this.logger.error('Error al cargar la imagen (base64):', error?.message || error);
      throw new BadRequestException('No se pudo cargar la imagen');
    }
  }

  // ---------- DELETE ----------
  async deleteByKey(key: string) {
    try {
      const del = new DeleteObjectCommand({ Bucket: this.bucketName, Key: key });
      await this.s3.send(del);
      return true;
    } catch (error: any) {
      this.logger.error('Error al eliminar el objeto:', error?.message || error);
      return false;
    }
  }

  async deleteByUrl(url: string) {
    const key = this.parseKeyFromUrl(url);
    if (!key) return false;
    return this.deleteByKey(key);
  }

  // Soporta virtual-hosted y path-style, y CloudFront
  parseKeyFromUrl(url: string): string | null {
    try {
      const u = new URL(url);
      if (this.cloudfrontDomain && u.host.includes(this.cloudfrontDomain)) {
        return u.pathname.replace(/^\/+/, '');
      }
      // S3 virtual-hosted: https://bucket.s3.region.amazonaws.com/key
      if (u.hostname.includes('.s3.')) {
        return u.pathname.replace(/^\/+/, '');
      }
      // S3 path-style: https://s3.region.amazonaws.com/bucket/key
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && (u.hostname.startsWith('s3.') || u.hostname === 's3.amazonaws.com')) {
        return parts.slice(1).join('/');
      }
      return u.pathname.replace(/^\/+/, '');
    } catch {
      return null;
    }
  }

  // ---------- GET BASE64 (tal como lo tenías) ----------
  async getImageBase64(imageUrl: string): Promise<string> {
    try {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const contentType = response.headers['content-type'];
      const base64String = Buffer.from(response.data, 'binary').toString('base64');
      return `data:${contentType};base64,${base64String}`;
    } catch (error: any) {
      this.logger.error('Error al descargar la imagen:', error?.message || error);
      throw new BadRequestException('No se pudo obtener la imagen en base64.');
    }
  }

  // ---------- (Opcional) Verificar que el objeto ya existe en S3 ----------
  async verifyExists(key: string): Promise<boolean> {
    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucketName, Key: key }));
      return true;
    } catch {
      return false;
    }
  }
}

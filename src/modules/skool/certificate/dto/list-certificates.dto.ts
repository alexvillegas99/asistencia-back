// src/modules/skool/certificate/dto/list-certificates.dto.ts
import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class ListCertificatesDto {
  @IsOptional() @IsMongoId() communityId?: string;
  @IsOptional() @IsMongoId() courseId?: string;
  @IsOptional() @IsMongoId() userId?: string;
  @IsOptional() @IsMongoId() externalUserId?: string;
  @IsOptional() @IsString() status?: 'issued'|'revoked';
  @IsOptional() limit?: number;
  @IsOptional() skip?: number;
}

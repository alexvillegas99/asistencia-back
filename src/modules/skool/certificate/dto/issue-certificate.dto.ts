// src/modules/skool/certificate/dto/issue-certificate.dto.ts
import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class IssueCertificateDto {
  @IsMongoId() enrollmentId: string; // matrícula completada

  // si quieres forzar nombres/títulos en snapshot
  @IsOptional() @IsString() studentName?: string;
  @IsOptional() @IsString() courseTitle?: string;
  @IsOptional() @IsString() communityName?: string;
  @IsOptional() scorePercent?: number;
}

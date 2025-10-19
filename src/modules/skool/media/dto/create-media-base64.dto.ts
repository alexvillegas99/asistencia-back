// src/modules/media/dto/create-media-base64.dto.ts
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMediaBase64Dto {
  // dataURL completo o base64 puro
  @IsString() @IsNotEmpty() @MaxLength(12_000_000)  // ~12MB texto
  image: string;

  // carpeta base en S3 donde lo quieres guardar (ej: "skool/cover" o "skool/<communityId>/cover")
  @IsString() @IsNotEmpty()
  route: string;

  // si no viene dataURL, puedes pasar el contentType aquí (ej: "image/png")
  @IsOptional() @IsString()
  contentType?: string;
}

// src/modules/skool/external-user/dto/create-external-user.dto.ts
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateExternalUserDto {
  @IsString()
  fullName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @MinLength(8)
  password?: string; // opcional; el hash se construye en el service

  @IsOptional()
  @IsIn(['invited', 'active', 'blocked'])
  status?: 'invited' | 'active' | 'blocked';

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

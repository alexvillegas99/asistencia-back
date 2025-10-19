// src/modules/skool/external-user/dto/update-external-user.dto.ts
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateExternalUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsIn(['invited', 'active', 'blocked'])
  status?: 'invited' | 'active' | 'blocked';

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

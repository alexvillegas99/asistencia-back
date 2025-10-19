// src/modules/skool/community/dto/update-community.dto.ts
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateCommunityDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() avatarMediaId?: string;
  @IsOptional() @IsString() bannerMediaId?: string;

  @IsOptional() @IsEnum(['public','private'] as any)
  visibility?: 'public' | 'private';

  @IsOptional() @IsEnum(['active','archived'] as any)
  status?: 'active' | 'archived';

  @IsOptional() settings?: Record<string, any>;
}

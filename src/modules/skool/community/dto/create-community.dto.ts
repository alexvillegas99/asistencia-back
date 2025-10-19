// src/modules/skool/community/dto/create-community.dto.ts
import { IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';

export class CreateCommunityDto {
  @IsString() name: string;
  @IsOptional()
  @IsMongoId()
  ownerId?: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() avatarMediaId?: string;
  @IsOptional() @IsString() bannerMediaId?: string;

  @IsOptional()
  @IsEnum(['public', 'private'] as any)
  visibility?: 'public' | 'private';
}

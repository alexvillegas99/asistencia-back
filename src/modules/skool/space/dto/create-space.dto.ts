// dto/create-space.dto.ts
import { IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';
export class CreateSpaceDto {
  @IsMongoId() communityId: string;
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(['active','archived'] as any) status?: 'active'|'archived';
  @IsOptional() sortIndex?: number;
}
export class UpdateSpaceDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() sortIndex?: number;
  @IsOptional() @IsEnum(['active','archived'] as any) status?: 'active'|'archived';
  @IsOptional() settings?: Record<string, any>;
}


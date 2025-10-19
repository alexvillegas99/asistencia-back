// src/modules/skool/membership/dto/add-member.dto.ts
import { IsEnum, IsMongoId, IsOptional } from 'class-validator';

export class AddMemberDto {
  @IsMongoId() communityId: string;

  // uno de los dos:
  @IsOptional() @IsMongoId() userId?: string;
  @IsOptional() @IsMongoId() externalUserId?: string;

  @IsOptional() @IsEnum(['owner','admin','mod','member'] as any)
  role?: 'owner'|'admin'|'mod'|'member';

  @IsOptional() meta?: Record<string, any>;
}

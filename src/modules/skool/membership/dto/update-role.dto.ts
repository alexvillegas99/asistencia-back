// src/modules/skool/membership/dto/update-role.dto.ts
import { IsEnum } from 'class-validator';
export class UpdateRoleDto {
  @IsEnum(['owner','admin','mod','member'] as any)
  role: 'owner'|'admin'|'mod'|'member';
}

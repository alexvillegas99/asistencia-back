// src/modules/skool/membership/dto/update-status.dto.ts
import { IsEnum } from 'class-validator';
export class UpdateStatusDto {
  @IsEnum(['invited','active','banned'] as any)
  status: 'invited'|'active'|'banned';
}

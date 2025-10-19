// src/modules/skool/membership/require-role.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const COMMUNITY_ROLE_KEY = 'COMMUNITY_ROLE_KEY';
export const RequireCommunityRole = (role: 'owner'|'admin'|'mod'|'member') =>
  SetMetadata(COMMUNITY_ROLE_KEY, role);

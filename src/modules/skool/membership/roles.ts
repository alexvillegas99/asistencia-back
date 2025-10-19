// src/modules/skool/membership/roles.ts
export type CommunityRole = 'owner'|'admin'|'mod'|'member';

export const ROLE_WEIGHT: Record<CommunityRole, number> = {
  owner: 3, admin: 2, mod: 1, member: 0,
};

export function hasAtLeast(role: CommunityRole, required: CommunityRole) {
  return ROLE_WEIGHT[role] >= ROLE_WEIGHT[required];
}

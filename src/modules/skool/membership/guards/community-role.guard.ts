import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { COMMUNITY_ROLE_KEY } from '../require-role.decorator';
import { MembershipRepo } from '../repos/membership.repo';
import { hasAtLeast } from '../roles';
import { Types } from 'mongoose';


@Injectable()
export class CommunityRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly memberships: MembershipRepo,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req: any = ctx.switchToHttp().getRequest();
    const required = this.reflector.get<'owner'|'admin'|'mod'|'member'>(COMMUNITY_ROLE_KEY, ctx.getHandler());

    // Dónde viene communityId: params | query | body (ajusta a tu ruta)
    const communityId =
      req.params?.communityId || req.query?.communityId || req.body?.communityId;
    if (!communityId) throw new ForbiddenException('communityId requerido');

    const actor = {
      userId: req.user?._id,
      externalUserId: req.user?.externalId,
    };
    const m = await this.memberships.findByActor(communityId, actor);
    if (!m || m.status !== 'active') throw new ForbiddenException('No miembro activo');

    // Adjunta membership al request para otras capas
    req.member = { _id: String(m._id), role: m.role, communityId: String(m.communityId) };

    if (!required) return true; // si no se definió rol requerido, alcanza con ser miembro
    if (hasAtLeast(m.role, required)) return true;

    throw new ForbiddenException('Rol insuficiente');
  }
}

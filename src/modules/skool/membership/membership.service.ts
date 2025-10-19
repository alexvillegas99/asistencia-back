// src/modules/skool/membership/membership.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { MembershipRepo } from './repos/membership.repo';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@Injectable()
export class MembershipService {
  constructor(private readonly repo: MembershipRepo) {}

  async add(dto: AddMemberDto, invitedById?: string) {
    if (!dto.userId && !dto.externalUserId) {
      throw new BadRequestException('Debe indicar userId o externalUserId');
    }
    if (dto.userId && dto.externalUserId) {
      throw new BadRequestException('Use solo uno: userId o externalUserId');
    }
    const data: any = {
      communityId: new Types.ObjectId(dto.communityId),
      role: dto.role ?? 'member',
      status: 'active',
      joinedAt: new Date(),
      meta: dto.meta ?? {},
    };
    if (dto.userId) data.userId = new Types.ObjectId(dto.userId);
    if (dto.externalUserId) data.externalUserId = new Types.ObjectId(dto.externalUserId);
    if (invitedById) data.invitedById = new Types.ObjectId(invitedById);

    // si ya existe, devuelve existente
    const exists = await this.repo.findOne({
      communityId: data.communityId,
      ...(data.userId ? { userId: data.userId } : {}),
      ...(data.externalUserId ? { externalUserId: data.externalUserId } : {}),
    });
    if (exists) return exists;

    return this.repo.create(data);
  }

  async get(id: string) {
    const m = await this.repo.findById(id);
    if (!m) throw new NotFoundException('Membresía no encontrada');
    return m;
  }

  list(params: { communityId: string; role?: string; status?: string; q?: string; limit?: number; skip?: number }) {
    const f: any = { communityId: new Types.ObjectId(params.communityId) };
    if (params.role) f.role = params.role;
    if (params.status) f.status = params.status;
    // `q` podría buscar por meta/displayName si lo guardas ahí
    return this.repo.list(f, params.limit ?? 50, params.skip ?? 0);
  }

  async setRole(id: string, dto: UpdateRoleDto) {
    const m = await this.repo.updateById(id, { role: dto.role });
    if (!m) throw new NotFoundException('Membresía no encontrada');
    return m;
  }

  async setStatus(id: string, dto: UpdateStatusDto) {
    const upd: any = { status: dto.status };
    if (dto.status === 'active') upd.joinedAt = new Date();
    const m = await this.repo.updateById(id, upd);
    if (!m) throw new NotFoundException('Membresía no encontrada');
    return m;
  }

  async remove(id: string) {
    const m = await this.repo.deleteById(id);
    if (!m) throw new NotFoundException('Membresía no encontrada');
    return { ok: true };
  }

  async getMyMembership(communityId: string, actor: { userId?: string; externalUserId?: string }) {
    return this.repo.findByActor(communityId, actor);
  }
}

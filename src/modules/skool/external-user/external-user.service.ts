// src/modules/skool/external-user/external-user.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { CreateExternalUserDto } from './dto/create-external-user.dto';
import { UpdateExternalUserDto } from './dto/update-external-user.dto';
import { ExternalUserRepo } from './repos/external-user.repo';

function sha256(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

@Injectable()
export class ExternalUserService {
  constructor(private readonly repo: ExternalUserRepo) {}

  async create(dto: CreateExternalUserDto) {
    const exists = await this.repo.findOne({ email: dto.email.toLowerCase() });
    if (exists) throw new BadRequestException('Email ya registrado');

    const data: any = {
      fullName: dto.fullName,
      email: dto.email.toLowerCase(),
      status: dto.status ?? 'invited',
      phone: dto.phone,
      metadata: dto.metadata,
    };

    if (dto.password) {
      data.passwordHash = sha256(dto.password);
    }

    return this.repo.create(data);
  }

  async findById(id: string) {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundException('No encontrado');
    return user;
  }

  list(params?: { status?: string; q?: string; limit?: number; skip?: number }) {
    const filter: any = {};
    if (params?.status) filter.status = params.status;
    if (params?.q) {
      filter.$or = [
        { fullName: new RegExp(params.q, 'i') },
        { email: new RegExp(params.q, 'i') },
        { phone: new RegExp(params.q, 'i') },
      ];
    }
    return this.repo.findMany(filter, params?.limit ?? 50, params?.skip ?? 0);
  }

  async update(id: string, dto: UpdateExternalUserDto) {
    const update: any = { ...dto };
    if (dto.email) update.email = dto.email.toLowerCase();
    if (dto.password) {
      update.passwordHash = sha256(dto.password);
      delete update.password;
    }
    const user = await this.repo.updateById(id, update);
    if (!user) throw new NotFoundException('No encontrado');
    return user;
  }

  async remove(id: string) {
    const user = await this.repo.deleteById(id);
    if (!user) throw new NotFoundException('No encontrado');
    return { ok: true };
  }

  // helpers
  findByEmail(email: string) {
    return this.repo.findOne({ email: email.toLowerCase() });
  }
}

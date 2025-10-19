// src/modules/skool/membership/membership.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { MembershipService } from './membership.service';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@Controller('skool/memberships')
export class MembershipController {
  constructor(private readonly service: MembershipService) {}

  @Post()
  add(@Body() dto: AddMemberDto, @Req() req: any) {
    const invitedById = req.user?._id;
    return this.service.add(dto, invitedById);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Get()
  list(
    @Query('communityId') communityId: string,
    @Query('role') role?: 'owner'|'admin'|'mod'|'member',
    @Query('status') status?: 'invited'|'active'|'banned',
    @Query('limit') limit = 50,
    @Query('skip') skip = 0,
  ) {
    return this.service.list({ communityId, role, status, limit: Number(limit), skip: Number(skip) });
  }

  @Patch(':id/role')
  setRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.service.setRole(id, dto);
  }

  @Patch(':id/status')
  setStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.service.setStatus(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // útil para front: "¿quién soy en esta comunidad?"
  @Get('me/by-community/:communityId')
  me(@Param('communityId') communityId: string, @Req() req: any) {
    const actor = { userId: req.user?._id, externalUserId: req.user?.externalId };
    return this.service.getMyMembership(communityId, actor);
  }
}

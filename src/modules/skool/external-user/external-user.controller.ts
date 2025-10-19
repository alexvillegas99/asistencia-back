// src/modules/skool/external-user/external-user.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateExternalUserDto } from './dto/create-external-user.dto';
import { UpdateExternalUserDto } from './dto/update-external-user.dto';
import { ExternalUserService } from './external-user.service';

// TIP: cuando tengas tus guards listos, añade:
// @UseGuards(JwtAuthGuard, CommunityRoleGuard)
// @CommunityRoles('admin','owner')
@Controller('skool/external-users')
export class ExternalUserController {
  constructor(private readonly service: ExternalUserService) {}

  @Post()
  create(@Body() dto: CreateExternalUserDto) {
    return this.service.create(dto);
  }

  @Get()
  list(
    @Query('status') status?: 'invited' | 'active' | 'blocked',
    @Query('q') q?: string,
    @Query('limit') limit = 50,
    @Query('skip') skip = 0,
  ) {
    return this.service.list({ status, q, limit: Number(limit), skip: Number(skip) });
  }

  @Get(':id')
  find(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateExternalUserDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

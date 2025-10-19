// src/modules/skool/community/community.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CommunityService } from './community.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';

// Más adelante: @UseGuards(JwtAuthGuard, CommunityRoleGuard)
@Controller('skool/communities')
export class CommunityController {
  constructor(private readonly service: CommunityService) {}

  @Post()
  create(@Body() dto: any) {
    console.log(dto);
    return this.service.create(dto);
  }

  @Get()
  list(
    @Query('q') q?: string,
    @Query('visibility') visibility?: 'public'|'private',
    @Query('status') status?: 'active'|'archived',
    @Query('ownerId') ownerId?: string,
    @Query('limit') limit = 50,
    @Query('skip') skip = 0,
  ) {
    return this.service.list({ q, visibility, status, ownerId, limit: Number(limit), skip: Number(skip) });
  }

  @Get(':id')
  find(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

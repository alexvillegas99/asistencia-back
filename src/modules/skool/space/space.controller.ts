// space.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { SpaceService } from './space.service'; import { CreateSpaceDto, UpdateSpaceDto } from './dto/create-space.dto';
@Controller('skool/spaces')
export class SpaceController {
  constructor(private readonly service: SpaceService) {}
  @Post() create(@Body() dto: CreateSpaceDto) { return this.service.create(dto); }
  @Get() list(@Query('communityId') communityId: string, @Query('status') status?: 'active'|'archived', @Query('limit') limit=100, @Query('skip') skip=0) {
    return this.service.list({ communityId, status, limit: Number(limit), skip: Number(skip) });
  }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateSpaceDto) { return this.service.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}

// src/modules/skool/post/post.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

// TODO: añade tus guards (JwtAuthGuard, MembershipGuard, etc.)
@Controller('skool/posts')
export class SkoolPostController {
  constructor(private readonly service: PostService) {}

  @Post()
  create(@Body() dto: CreatePostDto) {
    return this.service.create(dto);
  }

  @Get()
  list(
    @Query('communityId') communityId: string,
    @Query('spaceId') spaceId?: string,
    @Query('q') q?: string,
    @Query('limit') limit = 50,
    @Query('skip') skip = 0,
  ) {
    return this.service.list({ communityId, spaceId, q, limit: Number(limit), skip: Number(skip) });
  }

  @Get(':id')
  find(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePostDto, @Req() req: any) {
    const actor = {
      userId: req.user?._id,
      externalUserId: req.user?.externalId,
      isModOrAdmin: req.member && ['owner','admin','mod'].includes(req.member.role),
    };
    return this.service.update(id, dto, actor);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    const actor = {
      userId: req.user?._id,
      externalUserId: req.user?.externalId,
      isModOrAdmin: req.member && ['owner','admin','mod'].includes(req.member.role),
    };
    return this.service.remove(id, actor);
  }
}

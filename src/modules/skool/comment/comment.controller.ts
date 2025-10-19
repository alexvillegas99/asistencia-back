// comment.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { CommentService } from './comment.service'; import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
@Controller('skool/comments')
export class SkoolCommentController {
  constructor(private readonly service: CommentService) {}
  @Post() create(@Body() dto: CreateCommentDto) { return this.service.create(dto); }
  @Get('by-post/:postId') list(@Param('postId') postId: string, @Query('limit') limit=100, @Query('skip') skip=0) {
    return this.service.listByPost(postId, Number(limit), Number(skip));
  }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateCommentDto, @Req() req: any) {
    const actor = { userId: req.user?._id, externalUserId: req.user?.externalId, isModOrAdmin: req.member && ['owner','admin','mod'].includes(req.member.role) };
    return this.service.update(id, dto, actor);
  }
  @Delete(':id') remove(@Param('id') id: string, @Req() req: any) {
    const actor = { userId: req.user?._id, externalUserId: req.user?.externalId, isModOrAdmin: req.member && ['owner','admin','mod'].includes(req.member.role) };
    return this.service.remove(id, actor);
  }
}

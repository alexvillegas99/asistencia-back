// src/modules/skool/course/course.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CourseService } from './course.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

// Luego añade tus guards: JwtAuthGuard, MembershipGuard, CommunityRoleGuard, etc.
// @UseGuards(JwtAuthGuard, MembershipGuard)
@Controller('skool/courses')
export class CourseController {
  constructor(private readonly service: CourseService) {}

  @Post()
  create(@Body() dto: any) {

    return this.service.create(dto);
  }

  @Get()
  list(
    @Query('communityId') communityId?: string,
    @Query('q') q?: string,
    @Query('visibility') visibility?: 'public'|'private',
    @Query('status') status?: 'draft'|'published'|'archived',
    @Query('limit') limit = 50,
    @Query('skip') skip = 0,
  ) {
    return this.service.list({ communityId, q, visibility, status, limit: Number(limit), skip: Number(skip) });
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

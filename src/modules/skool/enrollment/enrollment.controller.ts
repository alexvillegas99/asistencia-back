// src/modules/skool/enrollment/enrollment.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { EnrollmentService } from './enrollment.service';
import { EnrollDto } from './dto/enroll.dto';
import { ProgressDto } from './dto/progress.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

// Añade tus guards (JwtAuthGuard, MembershipGuard) según tu flujo
@Controller('skool/enrollments')
export class EnrollmentController {
  constructor(private readonly service: EnrollmentService) {}

  @Post()
  enroll(@Body() dto: EnrollDto) {
    return this.service.enroll(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Get()
  list(
    @Query('courseId') courseId?: string,
    @Query('userId') userId?: string,
    @Query('externalUserId') externalUserId?: string,
    @Query('status') status?: 'active'|'completed'|'cancelled',
    @Query('limit') limit = 50,
    @Query('skip') skip = 0,
  ) {
    return this.service.list({ courseId, userId, externalUserId, status, limit: Number(limit), skip: Number(skip) });
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.service.updateStatus(id, dto);
  }

  @Post(':id/progress')
  pushProgress(@Param('id') id: string, @Body() body: ProgressDto) {
    return this.service.pushProgress(id, body);
  }

  @Delete(':id')
  unregister(@Param('id') id: string) {
    return this.service.unregister(id);
  }
}

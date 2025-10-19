// event.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { EventService } from './event.service'; import { CreateEventDto } from './dto/create-event.dto';
@Controller('skool/events')
export class EventController {
  constructor(private readonly service: EventService) {}
  @Post() create(@Body() dto: CreateEventDto) { return this.service.create(dto); }
  @Get() list(@Query('communityId') communityId: string, @Query('courseId') courseId?: string, @Query('from') from?: string, @Query('to') to?: string, @Query('limit') limit=50, @Query('skip') skip=0) {
    return this.service.list({ communityId, courseId, from, to, limit: Number(limit), skip: Number(skip) });
  }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: CreateEventDto) { return this.service.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}

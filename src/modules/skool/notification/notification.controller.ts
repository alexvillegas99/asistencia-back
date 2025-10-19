// notification.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { NotificationService } from './notification.service';
@Controller('skool/notifications')
export class NotificationController {
  constructor(private readonly service: NotificationService) {}
  @Post() notify(@Body() body: any) { return this.service.notify(body); }
  @Get('inbox') inbox(@Query('communityId') communityId: string, @Req() req: any, @Query('limit') limit=50, @Query('skip') skip=0, @Query('unreadOnly') unreadOnly?: string) {
    return this.service.inbox({ communityId, userId: req.user?._id, externalUserId: req.user?.externalId, limit: Number(limit), skip: Number(skip), unreadOnly: unreadOnly==='true' });
  }
  @Patch(':id/read') read(@Param('id') id: string) { return this.service.markRead(id); }
  @Patch('read-all') readAll(@Query('communityId') communityId: string, @Req() req: any) {
    return this.service.markAllRead({ communityId, userId: req.user?._id, externalUserId: req.user?.externalId });
  }
}

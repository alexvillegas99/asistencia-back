// moderation.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ModerationService } from './moderation.service';
@Controller('skool/moderation')
export class ModerationController {
  constructor(private readonly service: ModerationService) {}
  @Post('report') report(@Body() body: any, @Req() req: any) {
    return this.service.create({ ...body, reporterId: req.user?._id, externalReporterId: req.user?.externalId });
  }
  @Get('reports') list(@Query('communityId') communityId: string, @Query('status') status?: string, @Query('targetType') targetType?: string, @Query('limit') limit=50, @Query('skip') skip=0) {
    return this.service.list({ communityId, status, targetType, limit: Number(limit), skip: Number(skip) });
  }
  @Patch('reports/:id/status') set(@Param('id') id: string, @Body('status') status: any, @Body('resolutionNote') note?: string, @Req() req?: any) {
    return this.service.setStatus(id, status, note, req?.user?._id);
  }
}

// metrics.controller.ts
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { MetricsService } from './metrics.service';
@Controller('skool/metrics')
export class MetricsController {
  constructor(private readonly service: MetricsService) {}
  @Post('track') track(@Body() body: any) { return this.service.track(body); }
  @Get() list(@Query('communityId') communityId: string, @Query('type') type?: string, @Query('limit') limit=100, @Query('skip') skip=0) {
    return this.service.list({ communityId, type, limit: Number(limit), skip: Number(skip) });
  }
  @Get('daily') daily(@Query('communityId') communityId: string, @Query('type') type?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.aggDaily(communityId, type, from, to);
  }
}

// src/modules/skool/certificate/certificate.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { IssueCertificateDto } from './dto/issue-certificate.dto';
import { ListCertificatesDto } from './dto/list-certificates.dto';

// Puedes proteger emisión/revocación con CommunityRoleGuard (owner/admin)
@Controller('skool/certificates')
export class CertificateController {
  constructor(private readonly service: CertificateService) {}

  @Post('issue')
  issue(@Body() dto: IssueCertificateDto) {
    return this.service.issue(dto);
  }

  @Get()
  list(@Query() q: ListCertificatesDto) {
    return this.service.list({
      communityId: q.communityId,
      courseId: q.courseId,
      userId: q.userId,
      externalUserId: q.externalUserId,
      status: q.status,
      limit: q.limit,
      skip: q.skip,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  // verificación pública (sin auth)
  @Get('verify/:code')
  verify(@Param('code') code: string) {
    return this.service.verifyByCode(code);
  }

  @Patch(':id/revoke')
  revoke(@Param('id') id: string) {
    return this.service.revoke(id);
  }
}

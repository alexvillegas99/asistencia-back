// src/modules/skool/certificate/certificate.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SkoolCertificate, SkoolCertificateSchema } from './schemas/certificate.schema';
import { CertificateRepo } from './repos/certificate.repo';
import { CertificateService } from './certificate.service';
import { CertificateController } from './certificate.controller';
import { Enrollment, EnrollmentSchema } from '../enrollment/schemas/enrollment.schema';
import { EnrollmentRepo } from '../enrollment/repos/enrollment.repo';
import { SkoolCourse, SkoolCourseSchema } from '../course/schemas/course.schema';
import { CourseRepo } from '../course/repos/course.repo';
import { SkoolCommunity, SkoolCommunitySchema } from '../community/schemas/community.schema';
import { CommunityRepo } from '../community/repos/community.repo';
import { AmazonS3Service } from '../../../amazon-s3/amazon-s3.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SkoolCertificate.name, schema: SkoolCertificateSchema },
      { name: Enrollment.name, schema: EnrollmentSchema },
      { name: SkoolCourse.name, schema: SkoolCourseSchema },
      { name: SkoolCommunity.name, schema: SkoolCommunitySchema },
    ]),
  ],
  controllers: [CertificateController],
  providers: [
    CertificateRepo, CertificateService,
    EnrollmentRepo, CourseRepo, CommunityRepo,
    AmazonS3Service,
  ],
  exports: [CertificateService, CertificateRepo],
})
export class CertificateModule {}

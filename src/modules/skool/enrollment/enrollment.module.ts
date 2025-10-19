// src/modules/skool/enrollment/enrollment.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Enrollment, EnrollmentSchema } from './schemas/enrollment.schema';
import { EnrollmentRepo } from './repos/enrollment.repo';
import { EnrollmentService } from './enrollment.service';
import { EnrollmentController } from './enrollment.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Enrollment.name, schema: EnrollmentSchema }]),
  ],
  controllers: [EnrollmentController],
  providers: [EnrollmentRepo, EnrollmentService],
  exports: [EnrollmentService, EnrollmentRepo],
})
export class EnrollmentModule {}

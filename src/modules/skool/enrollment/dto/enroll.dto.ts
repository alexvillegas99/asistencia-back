// src/modules/skool/enrollment/dto/enroll.dto.ts
import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class EnrollDto {
  @IsMongoId()
  courseId: string;

  // uno de los dos:
  @IsOptional() @IsMongoId()
  userId?: string;

  @IsOptional() @IsMongoId()
  externalUserId?: string;

  @IsOptional()
  meta?: Record<string, any>;
}

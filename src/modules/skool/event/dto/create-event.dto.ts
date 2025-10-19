// dto/create-event.dto.ts
import { IsBoolean, IsDateString, IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';
export class CreateEventDto {
  @IsMongoId() communityId: string;
  @IsOptional() @IsMongoId() courseId?: string;
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsDateString() startsAt: string;
  @IsDateString() endsAt: string;
  @IsOptional() @IsEnum(['online','onsite'] as any) locationType?: 'online'|'onsite';
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsBoolean() allDay?: boolean;
  @IsOptional() attachments?: string[];
}
export class UpdateEventDto extends CreateEventDto {}

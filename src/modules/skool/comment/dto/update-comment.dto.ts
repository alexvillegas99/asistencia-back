import { IsArray, IsOptional, IsString } from 'class-validator';
export class UpdateCommentDto {
  @IsOptional() @IsString() body?: string;
  @IsOptional() @IsArray() attachments?: string[];
}
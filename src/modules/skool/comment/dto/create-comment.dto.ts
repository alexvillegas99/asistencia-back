import { IsArray, IsMongoId, IsOptional, IsString } from 'class-validator';
export class CreateCommentDto {
  @IsMongoId() postId: string;
  @IsMongoId() communityId: string;
  @IsString() body: string;
  @IsOptional() @IsArray() attachments?: string[];
  @IsOptional() @IsMongoId() authorId?: string;
  @IsOptional() @IsMongoId() externalAuthorId?: string;
}
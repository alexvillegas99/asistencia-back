// src/modules/skool/post/dto/create-post.dto.ts
import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePostDto {
  @IsMongoId()
  communityId: string;

  @IsOptional() @IsMongoId()
  spaceId?: string;

  @IsString() @MaxLength(200)
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  attachments?: string[]; // mediaIds

  // uno de los dos (según tu auth)
  @IsOptional() @IsMongoId()
  authorId?: string;

  @IsOptional() @IsMongoId()
  externalAuthorId?: string;
}

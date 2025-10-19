// src/modules/skool/post/post.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SkoolPost, SkoolPostSchema } from './schemas/post.schema';
import { PostRepo } from './repos/post.repo';
import { PostService } from './post.service';
import { SkoolPostController } from './post.controller';

@Module({
  imports: [ MongooseModule.forFeature([{ name: SkoolPost.name, schema: SkoolPostSchema }]) ],
  controllers: [SkoolPostController],
  providers: [PostRepo, PostService],
  exports: [PostService, PostRepo],
})
export class PostModule {}

// comment.module.ts
import { Module } from '@nestjs/common'; import { MongooseModule } from '@nestjs/mongoose';
import { SkoolComment, SkoolCommentSchema } from './schemas/comment.schema';
import { CommentRepo } from './repos/comment.repo'; import { CommentService } from './comment.service';
import { SkoolCommentController } from './comment.controller';
@Module({
  imports: [ MongooseModule.forFeature([{ name: SkoolComment.name, schema: SkoolCommentSchema }]) ],
  controllers: [SkoolCommentController],
  providers: [CommentRepo, CommentService],
  exports: [CommentService, CommentRepo],
}) export class CommentModule {}

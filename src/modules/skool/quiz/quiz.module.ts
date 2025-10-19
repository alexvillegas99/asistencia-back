// src/modules/skool/quiz/quiz.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SkoolQuiz, SkoolQuizSchema } from './schemas/quiz.schema';
import { SkoolQuestion, SkoolQuestionSchema } from './schemas/question.schema';
import { SkoolAttempt, SkoolAttemptSchema } from './schemas/attempt.schema';
import { QuizRepo } from './repos/quiz.repo';
import { QuizService } from './quiz.service';
import { QuizController } from './quiz.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SkoolQuiz.name, schema: SkoolQuizSchema },
      { name: SkoolQuestion.name, schema: SkoolQuestionSchema },
      { name: SkoolAttempt.name, schema: SkoolAttemptSchema },
    ]),
  ],
  controllers: [QuizController],
  providers: [QuizRepo, QuizService],
  exports: [QuizService, QuizRepo],
})
export class QuizModule {}

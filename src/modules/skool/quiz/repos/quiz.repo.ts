// src/modules/skool/quiz/repos/quiz.repo.ts
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { SkoolQuiz, SkoolQuizDocument } from '../schemas/quiz.schema';
import { SkoolQuestion, SkoolQuestionDocument } from '../schemas/question.schema';
import { SkoolAttempt, SkoolAttemptDocument } from '../schemas/attempt.schema';

export class QuizRepo {
  constructor(
    @InjectModel(SkoolQuiz.name) private readonly quizModel: Model<SkoolQuizDocument>,
    @InjectModel(SkoolQuestion.name) private readonly questionModel: Model<SkoolQuestionDocument>,
    @InjectModel(SkoolAttempt.name) private readonly attemptModel: Model<SkoolAttemptDocument>,
  ) {}

  // Quiz
  createQuiz(data: Partial<SkoolQuiz>) { return this.quizModel.create(data); }
  findQuizByLesson(lessonId: string) { return this.quizModel.findOne({ lessonId }).lean(); }
  findQuizById(id: string) { return this.quizModel.findById(id).lean(); }
  updateQuiz(id: string, update: Partial<SkoolQuiz>) {
    return this.quizModel.findByIdAndUpdate(id, update, { new: true }).lean();
  }

  // Questions
  addQuestion(data: Partial<SkoolQuestion>) { return this.questionModel.create(data); }
  listQuestions(quizId: string) { return this.questionModel.find({ quizId }).sort({ sortIndex: 1 }).lean(); }
  deleteQuestion(id: string) { return this.questionModel.findByIdAndDelete(id).lean(); }

  // Attempts
  createAttempt(data: Partial<SkoolAttempt>) { return this.attemptModel.create(data); }
  findAttemptById(id: string) { return this.attemptModel.findById(id).lean(); }
  listAttempts(filter: FilterQuery<SkoolAttempt>) { return this.attemptModel.find(filter).sort({ createdAt: -1 }).lean(); }
  updateAttempt(id: string, update: Partial<SkoolAttempt>) {
    return this.attemptModel.findByIdAndUpdate(id, update, { new: true }).lean();
  }
}

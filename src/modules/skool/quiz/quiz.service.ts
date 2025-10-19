// src/modules/skool/quiz/quiz.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { QuizRepo } from './repos/quiz.repo';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { AddQuestionDto } from './dto/add-question.dto';
import { SubmitAnswersDto } from './dto/submit-answers.dto';

function norm(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

@Injectable()
export class QuizService {
  constructor(private readonly repo: QuizRepo) {}

  // Crear o reemplazar quiz para una lección
  async create(dto: CreateQuizDto) {
    const lessonId = new Types.ObjectId(dto.lessonId);
    const existing = await this.repo.findQuizByLesson(dto.lessonId);
    if (existing) {
      return this.repo.updateQuiz(String(existing._id), {
        title: dto.title ?? existing.title,
        passMark: dto.passMark ?? existing.passMark,
        maxAttempts: dto.maxAttempts ?? existing.maxAttempts,
        status: dto.status ?? existing.status,
        categories: dto.categories ?? existing.categories,
      });
    }
    return this.repo.createQuiz({
      lessonId,
      title: dto.title ?? 'Cuestionario',
      passMark: dto.passMark ?? 70,
      maxAttempts: dto.maxAttempts ?? 1,
      status: dto.status ?? 'draft',
      categories: dto.categories ?? [],
    });
  }

  async addQuestion(quizId: string, dto: AddQuestionDto) {
    const quiz = await this.repo.findQuizById(quizId);
    if (!quiz) throw new NotFoundException('Quiz no encontrado');

    const autoLatex = anyLatex(
      dto.text,
      dto.options ?? [],
      dto.acceptableAnswers ?? [],
    );
    const renderMode =
      dto.renderMode ?? (autoLatex ? 'markdown+latex' : 'plain');

    return this.repo.addQuestion({
      quizId: new Types.ObjectId(quizId),
      text: dto.text,
      type: dto.type,
      options: dto.options ?? [],
      correctIndexes: dto.correctIndexes ?? [],
      acceptableAnswers: (dto.acceptableAnswers ?? []).map((a) =>
        norm(stripLatexDelimiters(a)),
      ),
      points: dto.points ?? 1,
      sortIndex: dto.sortIndex ?? 0,
      category: dto.category ?? '',
      renderMode,
    });
  }

  getByLesson(lessonId: string) {
    return this.repo.findQuizByLesson(lessonId);
  }

  listQuestions(quizId: string) {
    return this.repo.listQuestions(quizId);
  }

  // Comenzar intento (valida límite de intentos si aplica)
  async startAttempt(
    quizId: string,
    actor: { userId?: string; externalUserId?: string },
  ) {
    const quiz = await this.repo.findQuizById(quizId);
    if (!quiz) throw new NotFoundException('Quiz no encontrado');

    if (quiz.maxAttempts && (actor.userId || actor.externalUserId)) {
      const filter: any = { quizId: new Types.ObjectId(quizId) };
      if (actor.userId) filter.userId = new Types.ObjectId(actor.userId);
      if (actor.externalUserId)
        filter.externalUserId = new Types.ObjectId(actor.externalUserId);
      const attempts = await this.repo.listAttempts(filter);
      if (attempts.length >= quiz.maxAttempts) {
        throw new BadRequestException('Límite de intentos alcanzado');
      }
    }

    return this.repo.createAttempt({
      quizId: new Types.ObjectId(quizId),
      userId: actor.userId ? new Types.ObjectId(actor.userId) : undefined,
      externalUserId: actor.externalUserId
        ? new Types.ObjectId(actor.externalUserId)
        : undefined,
      answers: [],
      totalScore: 0,
      maxScore: 0,
      status: 'in_progress',
      passed: false,
    });
  }

  // Enviar respuestas y calificar
  async submit(quizId: string, attemptId: string, dto: SubmitAnswersDto) {
    const quiz = await this.repo.findQuizById(quizId);
    if (!quiz) throw new NotFoundException('Quiz no encontrado');

    const attempt = await this.repo.findAttemptById(attemptId);
    if (!attempt || String(attempt.quizId) !== String(quiz._id)) {
      throw new NotFoundException('Intento no encontrado');
    }
    if (attempt.status === 'submitted')
      throw new BadRequestException('El intento ya fue enviado');

    const questions = await this.repo.listQuestions(quizId);
    const qMap = new Map(questions.map((q) => [String(q._id), q]));

    let total = 0;
    let max = 0;
    const graded = (dto.answers || []).map((a) => {
      const q = qMap.get(a.questionId);
      if (!q) return { ...a, isCorrect: false, score: 0 };
      max += q.points ?? 1;

      let correct = false;
      if (q.type === 'shorttext') {
        const ans = norm(a.answerText || '');
        correct = !!q.acceptableAnswers?.some((x) => x === ans);
      } else {
        const given = new Set(a.answerIndexes || []);
        const correctSet = new Set(q.correctIndexes || []);
        correct =
          given.size === correctSet.size &&
          [...given].every((i) => correctSet.has(i));
      }

      const score = correct ? (q.points ?? 1) : 0;
      total += score;
      return { ...a, isCorrect: correct, score };
    });

    const percent = max ? Math.round((total / max) * 100) : 0;
    const passed = percent >= (quiz.passMark ?? 70);

    return this.repo.updateAttempt(attemptId, {
      answers: graded.map((g) => ({
        questionId: new Types.ObjectId(g.questionId),
        answerIndexes: g.answerIndexes,
        answerText: g.answerText,
        isCorrect: g.isCorrect,
        score: g.score,
      })),
      totalScore: total,
      maxScore: max,
      status: 'submitted',
      passed,
      submittedAt: new Date(),
    });
  }
}
function looksLikeLatex(s: string) {
  if (!s) return false;
  // Delimitadores típicos y comandos comunes
  return /(\$\$[^$]*\$\$)|(\$[^$]*\$)|\\\(|\\\)|\\\[|\\\]|\\frac|\\int|\\sum|\\alpha|\\beta|\\gamma/.test(
    s,
  );
}
function anyLatex(...items: (string[] | string | undefined)[]) {
  for (const it of items.flat()) {
    if (typeof it === 'string' && looksLikeLatex(it)) return true;
  }
  return false;
}
function stripLatexDelimiters(s: string) {
  let t = (s || '').trim();
  // $$...$$ o \[ ... \]
  if ((t.startsWith('$$') && t.endsWith('$$')) || (t.startsWith('\\[') && t.endsWith('\\]'))) {
    t = t.replace(/^\$\$|^\s*\\\[/,'').replace(/\$\$$|\\\]\s*$/,'');
  }
  // $...$ o \( ... \)
  if ((t.startsWith('$') && t.endsWith('$')) || (t.startsWith('\\(') && t.endsWith('\\)'))) {
    t = t.replace(/^\$|^\s*\\\(/,'').replace(/\$|\\\)\s*$/,'');
  }
  return t;
}
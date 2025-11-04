// src/modules/skool/quiz/quiz.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { AddQuestionDto } from './dto/add-question.dto';
import { SubmitAnswersDto } from './dto/submit-answers.dto';

// Añade tus guards (JwtAuthGuard, CommunityRoleGuard) según tu flow
@Controller('skool/quizzes')
export class QuizController {
  constructor(private readonly service: QuizService) {}

  // Crear/actualizar quiz para una lección
  @Post()
  create(@Body() dto: CreateQuizDto) {
    return this.service.create(dto);
  }

  // Agregar pregunta
  @Post(':quizId/questions')
  addQuestion(@Param('quizId') quizId: string, @Body() dto: AddQuestionDto) {
    return this.service.addQuestion(quizId, dto);
  }

  // Obtener quiz por lección
  @Get('by-lesson/:lessonId')
  getByLesson(@Param('lessonId') lessonId: string) {
    return this.service.getByLesson(lessonId);
  }

  // Listar preguntas
  @Get(':quizId/questions')
  listQuestions(@Param('quizId') quizId: string) {
    return this.service.listQuestions(quizId);
  }

  // Iniciar intento
  @Post(':quizId/attempts/start')
  start(@Param('quizId') quizId: string, @Req() req: any) {
    const actor = {
      userId: req.user?._id,
      externalUserId: req.user?.externalId,
    };
    return this.service.startAttempt(quizId, actor);
  }

  // Enviar intento (califica)
  @Post(':quizId/attempts/:attemptId/submit')
  submit(
    @Param('quizId') quizId: string,
    @Param('attemptId') attemptId: string,
    @Body() dto: SubmitAnswersDto,
  ) {
    return this.service.submit(quizId, attemptId, dto);
  }

  // Editar una pregunta
@Patch('questions/:id')
updateQuestion(@Param('id') id: string, @Body() dto: Partial<AddQuestionDto>) {
  return this.service.updateQuestion(id, dto);
}

// Eliminar una pregunta
@Delete('questions/:id')
deleteQuestion(@Param('id') id: string) {
  return this.service.deleteQuestion(id);
}
}

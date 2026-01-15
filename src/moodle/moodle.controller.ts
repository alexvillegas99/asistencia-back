import { AsistentesService } from 'src/asistentes/asistentes.service';
import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { MoodleService } from './moodle.service';
import { ApiQuery } from '@nestjs/swagger';
import { ReportsService } from 'src/common/services/reports.service';

@Controller('moodle')
export class MoodleController {
  constructor(
    private readonly moodleService: MoodleService,
    private readonly asistentesService: AsistentesService,
    private readonly reportsService: ReportsService,
  ) {}

  // 1) Buscar usuario por username
  @Get('users/by-username/:username')
  async getUserByUsername(@Param('username') username: string) {
    const user = await this.moodleService.getUserByUsername(username);
    return { user };
  }

  // 2) Cursos por userId
  @Get('users/:userId/courses')
  async getUserCourses(@Param('userId', ParseIntPipe) userId: number) {
    const courses = await this.moodleService.getUserCourses(userId);
    return { userId, courses };
  }

  // 3) Notas de un curso para un usuario
  @Get('users/:userId/courses/:courseId/grades')
  async getUserGradesForCourse(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('courseId', ParseIntPipe) courseId: number,
  ) {
    const rows = await this.moodleService.getUserGradesForCourse(
      courseId,
      userId,
    );
    return { userId, courseId, rows };
  }

  // 4) Reporte agregado (flujo completo del Postman)
  @Get('reports/grades')
  async getGradesReport(
    @Query('username') username: string,
    @Query('userId') userId?: string,
  ) {
    const uid = userId ? parseInt(userId, 10) : undefined;
    return this.moodleService.getGradesReportByUsername(username, uid);
  }

  @Get('courses/clean')
  async getCleanCourses(@Query('username') username: string) {
    return this.moodleService.getCleanCoursesByUsername(username);
  }

  @Get('courses/with-grades')
  async getCoursesWithGrades(@Query('username') username: string) {
    return this.moodleService.getCoursesWithGradesByUsername(username);
  }
  @Get('courses/with-gradesv2')
  async getCoursesWithGradesv2(@Query('username') username: string) {
    return this.moodleService.getCoursesWithGradesByUsernameV2(username);
  }

  @Get('courses/with-gradesv3/app')
  async getCoursesWithGradesv3(@Query('username') username: string) {
    return this.moodleService.getCoursesWithGradesByUsernameV3(username);
  }

  @Get('notas/pdf')
  @Header('Content-Type', 'application/pdf')
  async notasPorCedula(
    @Query('cedula') cedula: string,
    @Query('cursoId') cursoId?: string,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.reportsService.pdfNotasPorUsername(
      cedula,
      (u) => this.moodleService.getCoursesWithGradesByUsernameV3(u),

      // ✅ ahora puede resolver curso “target” si lo mandan
      (u) => this.asistentesService.buscarPorCedula(u, cursoId),
    );

    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }
}

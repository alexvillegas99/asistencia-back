import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { MoodleService } from './moodle.service';

@Controller('moodle')
export class MoodleController {
  constructor(private readonly moodleService: MoodleService) {}

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
  async getCleanCourses(
    @Query('username') username: string,
  ) {
 
    return this.moodleService.getCleanCoursesByUsername(username);
  }

  @Get('courses/with-grades')
  async getCoursesWithGrades(
    @Query('username') username: string,
  ) {
    return this.moodleService.getCoursesWithGradesByUsername(username);
  }
}

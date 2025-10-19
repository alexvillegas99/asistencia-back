// src/modules/skool/guards/lesson-access.guard.ts
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { LessonRepo } from '../lesson/repos/lesson.repo';
import { CourseRepo } from '../course/repos/course.repo';
import { EnrollmentRepo } from '../enrollment/repos/enrollment.repo';

@Injectable()
export class LessonAccessGuard implements CanActivate {
  constructor(
    private readonly lessons: LessonRepo,
    private readonly courses: CourseRepo,
    private readonly enrollments: EnrollmentRepo,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req: any = ctx.switchToHttp().getRequest();
    const lessonId = req.params.id || req.params.lessonId || req.body.lessonId;
    const l = await this.lessons.findById(lessonId);
    if (!l) throw new ForbiddenException('Lección no disponible');

    const c = await this.courses.findById(String(l.courseId));
    const role = req.member?.role;

    // Staff
    if (role && ['owner','admin','mod'].includes(role)) return true;

    // Preview habilita acceso si el curso está publicado
    if (l.isPreview && c?.status === 'published') return true;

    // Si curso es público y publicado → acceso
    if (c?.status === 'published' && c?.visibility === 'public') return true;

    // Caso privado → matrícula activa
    const f: any = { courseId: new Types.ObjectId(l.courseId), status: 'active' };
    if (req.user?._id) f.userId = new Types.ObjectId(req.user._id);
    if (req.user?.externalId) f.externalUserId = new Types.ObjectId(req.user.externalId);

    const en = await this.enrollments.findOne(f);
    if (en) return true;

    throw new ForbiddenException('Lección restringida: requiere matrícula activa');
  }
}

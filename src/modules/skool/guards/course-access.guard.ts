// src/modules/skool/guards/course-access.guard.ts
import {
  BadRequestException, CanActivate, ExecutionContext,
  ForbiddenException, Injectable
} from '@nestjs/common';
import { Types } from 'mongoose';
import { CourseRepo } from '../course/repos/course.repo';
import { EnrollmentRepo } from '../enrollment/repos/enrollment.repo';

@Injectable()
export class CourseAccessGuard implements CanActivate {
  constructor(
    private readonly courses: CourseRepo,
    private readonly enrollments: EnrollmentRepo,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req: any = ctx.switchToHttp().getRequest();
    const courseId = req.params.courseId || req.body.courseId || req.query.courseId;
    if (!courseId) throw new BadRequestException('courseId requerido');

    const course = await this.courses.findById(courseId);
    if (!course) throw new ForbiddenException('Curso no disponible');

    // Staff de comunidad (si lo tienes en req.member)
    const role = req.member?.role;
    if (role && ['owner','admin','mod'].includes(role)) return true;

    // Curso publicado y público → acceso libre
    if (course.status === 'published' && course.visibility === 'public') return true;

    // Requiere matrícula activa (usuario interno o externo)
    const f: any = { courseId: new Types.ObjectId(courseId), status: 'active' };
    if (req.user?._id) f.userId = new Types.ObjectId(req.user._id);
    if (req.user?.externalId) f.externalUserId = new Types.ObjectId(req.user.externalId);

    const en = await this.enrollments.findOne(f);
    if (en) return true;

    throw new ForbiddenException('Se requiere matrícula activa para este curso');
  }
}

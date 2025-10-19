import { Module } from '@nestjs/common';
import { CommunityModule } from './community/community.module';
import { MembershipModule } from './membership/membership.module';
import { SpaceModule } from './space/space.module';
import { PostModule } from './post/post.module';
import { CommentModule } from './comment/comment.module';
import { CourseModule } from './course/course.module';
import { LessonModule } from './lesson/lesson.module';
import { EnrollmentModule } from './enrollment/enrollment.module';
import { EventModule } from './event/event.module';
import { MediaModule } from './media/media.module';
import { NotificationModule } from './notification/notification.module';
import { ModerationModule } from './moderation/moderation.module';
import { MetricsModule } from './metrics/metrics.module';
import { ExternalUserModule } from './external-user/external-user.module';
import { QuizModule } from './quiz/quiz.module';
import { CertificateModule } from './certificate/certificate.module';
import { SectionModule } from './section/section.module';

@Module({
  imports: [
    CommunityModule,
    MembershipModule,
    SpaceModule,
    PostModule,
    CommentModule,
    CourseModule,
    LessonModule,
    EnrollmentModule,
    EventModule,
    MediaModule,
    NotificationModule,
    ModerationModule,
    MetricsModule,
    ExternalUserModule,
    QuizModule,
    CertificateModule,
    SectionModule,
  ],
})
export class SkoolModule {}

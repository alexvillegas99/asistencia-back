import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/config.env';
import { DatabaseModule } from './database/database.module';
import { AsistentesModule } from './asistentes/asistentes.module';
import { AsistenciasModule } from './asistencias/asistencias.module';
import { CursoModule } from './curso/curso.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { UsuariosModule } from './usuarios/usuarios.module';
import { AuthModule } from './auth/auth.module';
import { CodigosProfesoresModule } from './codigos_profesores/codigos_profesores.module';
import { AmazonS3Module } from './amazon-s3/amazon-s3.module';
import { CampanasModule } from './campanas/campanas.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { MoodleModule } from './moodle/moodle.module';
import { ScheduleModule } from '@nestjs/schedule';
import { SkoolModule } from './modules/skool/skool.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AsistentesModule,
    AsistenciasModule,
    CursoModule,
    UsuariosModule,
    AuthModule,
    CodigosProfesoresModule,
    AmazonS3Module,
    CampanasModule,
    NotificacionesModule,
    MoodleModule,
    SkoolModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

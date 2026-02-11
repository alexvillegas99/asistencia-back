import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EvaluacionesController } from './evaluaciones.controller';
import { EvaluacionesService } from './evaluaciones.service';
import { EvaluacionSchema } from './schemas/evaluacion.schema';
import { CalificacionProfesorSchema } from './schemas/calificacion.schema';
import { AsistentesModelName, AsistentesSchema } from 'src/asistentes/entities/asistente.entity';
import { CursoModelName, CursoSchema } from 'src/curso/entities/curso.entity';
import { UsuarioModelName, UsuarioSchema } from 'src/usuarios/entities/usuario.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Evaluacion', schema: EvaluacionSchema },
      { name: 'CalificacionProfesor', schema: CalificacionProfesorSchema },
       { name: UsuarioModelName, schema: UsuarioSchema },
      { name: AsistentesModelName, schema: AsistentesSchema },
      { name: CursoModelName, schema: CursoSchema },
    ]),
  ],
  controllers: [EvaluacionesController],
  providers: [EvaluacionesService],
})
export class EvaluacionesModule {}

import { Module } from '@nestjs/common';
import { AsistenciasService } from './asistencias.service';
import { AsistenciasController } from './asistencias.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { AsistenciaModelName, AsistenciaSchema } from './entities/asistencia.entity';
import { AsistentesModelName, AsistentesSchema } from 'src/asistentes/entities/asistente.entity';
import { CursoModelName, CursoSchema } from 'src/curso/entities/curso.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AsistentesModelName, schema: AsistentesSchema },
      { name: AsistenciaModelName, schema: AsistenciaSchema },
      {
        name: CursoModelName,
        schema: CursoSchema,
      }
    ]),
  ],
  controllers: [AsistenciasController],
  providers: [AsistenciasService],
})
export class AsistenciasModule {}

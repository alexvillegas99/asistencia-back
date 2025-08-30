import { Module } from '@nestjs/common';
import { AsistentesService } from './asistentes.service';
import { AsistentesController } from './asistentes.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AsistentesModelName,
  AsistentesSchema,
} from './entities/asistente.entity';
import { CursoModule } from 'src/curso/curso.module';
import {
  AsistenteMigradoSchema,
  AsistentesMigradosModelName,
} from './entities/asistentes-migrados.entity';

@Module({
  imports: [
    MongooseModule.forFeatureAsync([
      {
        name: AsistentesModelName,
        useFactory: () => {
          const schema = AsistentesSchema;
          // schema.plugin(mongoosePaginate);
          return schema;
        },
      },
      {
        name: AsistentesMigradosModelName,
        useFactory: () => {
          const schema = AsistenteMigradoSchema;
          // schema.plugin(mongoosePaginate);
          return schema;
        },
      },
    ]),
    CursoModule,
  ],
  controllers: [AsistentesController],
  providers: [AsistentesService],
  exports: [AsistentesService],
})
export class AsistentesModule {}

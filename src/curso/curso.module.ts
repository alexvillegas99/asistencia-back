import { Module } from '@nestjs/common';
import { CursoService } from './curso.service';
import { CursoController } from './curso.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { CursoModelName, CursoSchema } from './entities/curso.entity';

@Module({
   imports:[
      MongooseModule.forFeatureAsync([
        {
          name: CursoModelName,
          useFactory: () => {
            const schema = CursoSchema;
            // schema.plugin(mongoosePaginate);
            return schema;
          },
        },
      ]),
    ],
  controllers: [CursoController],
  providers: [CursoService],
  exports: [CursoService]
})
export class CursoModule {}

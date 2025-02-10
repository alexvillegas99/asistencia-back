import { Module } from '@nestjs/common';
import { CodigosProfesoresController } from './codigos_profesores.controller';
import { CodigoProfesoresService } from './codigos_profesores.service';
import { MongooseModule } from '@nestjs/mongoose';
import { CodigoProfesoresModelName, CodigoProfesoresSchema } from './entities/codigos_profesore.entity';
import { UsuariosModule } from 'src/usuarios/usuarios.module';

@Module({
   imports:[
          MongooseModule.forFeatureAsync([
            {
              name: CodigoProfesoresModelName,
              useFactory: () => {
                const schema = CodigoProfesoresSchema;
                return schema;
              },
            },
          ]),
          UsuariosModule
        ],
  controllers: [CodigosProfesoresController],
  providers: [CodigoProfesoresService],
})
export class CodigosProfesoresModule {}

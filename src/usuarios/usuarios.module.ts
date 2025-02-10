import { Module } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { UsuarioModelName, UsuarioSchema } from './entities/usuario.entity';

@Module({
   imports:[
        MongooseModule.forFeatureAsync([
          {
            name: UsuarioModelName,
            useFactory: () => {
              const schema = UsuarioSchema;
              return schema;
            },
          },
        ]),
      ],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService],
})
export class UsuariosModule {}

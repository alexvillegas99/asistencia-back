import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JWT_EXPIRES_IN, JWT_SECRET } from 'src/config/config.env';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { UsuariosModule } from 'src/usuarios/usuarios.module';
import { AsistentesModule } from 'src/asistentes/asistentes.module';
@Module({
  controllers: [AuthController],

  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>(JWT_SECRET),
        signOptions: { expiresIn: config.get(JWT_EXPIRES_IN) },
      }),

      inject: [ConfigService],
    }),

    UsuariosModule,
    AsistentesModule
  ],
  providers: [AuthService, JwtStrategy, LocalStrategy],
  exports: [AuthService],
})
export class AuthModule {}

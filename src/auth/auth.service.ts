import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { JWT_EXPIRES_IN, JWT_SECRET } from 'src/config/config.env';
import { JwtModule } from '@nestjs/jwt';
import { UsuariosService } from 'src/usuarios/usuarios.service';
import { AsistentesService } from 'src/asistentes/asistentes.service';

@Injectable()
export class AuthService {
  logger: Logger = new Logger(AuthService.name);

  constructor(
    //private readonly socioService: SocioService,
    private readonly jwtService: JwtService,
    private readonly usuariosService: UsuariosService,
    private readonly estudianteService: AsistentesService,
  ) {}

  async login({ email, password }: { email: string; password: string }) {
    const usuario = await this.usuariosService.findByEmail(email);
    //si usuario no se encuntra validar si es es un estudiante
    if (!usuario) {
      const estudiante = await this.estudianteService.buscarPorCedula(email);

      

      if (!estudiante) {
        throw new UnauthorizedException('Credenciales incorrectas');
      }
      console.log('estudiante', estudiante);
      const payload = { sub: estudiante._id };
      const accessToken = this.jwtService.sign(payload);

      return { accessToken, user: { ...estudiante, rol: 'ESTUDIANTE' } };
    }

    const isPasswordValid = await bcrypt.compare(password, usuario.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const payload = { sub: usuario._id };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: { id: usuario._id, email: usuario.email, rol: usuario.rol },
    };
  }

  generateRefreshToken(userId: string) {
    const payload = { sub: userId };
    return this.jwtService.sign(payload, { expiresIn: '7d' }); // Refresh token válido por 7 días
  }

  renewToken(id: string) {
    try {
      const payload = { sub: id };
      return this.jwtService.sign(payload);
    } catch (error) {
      throw new UnauthorizedException('Refresh token inválido');
    }
  }
}

import {
  Controller,
  Post,
  Body,
  Logger,
  Req,
  Res,
  Get,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Response, Request } from 'express';

import { Auth } from './decorators/auth.decorator';
import { GetUser } from './decorators';
import { EncryptionService } from 'src/encryption/encryption.service';
import { UsuariosService } from 'src/usuarios/usuarios.service';




@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly encryptionService: EncryptionService,
    private readonly usuariosService: UsuariosService,
  ) {}
  logger: Logger = new Logger(AuthController.name);

  @ApiOperation({ summary: 'Autentica al usuario con email y contraseña' })
  @Post('login')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        password: { type: 'string' },
      },
      example: {
        email: 'admin@example.com',
        password: 'admin123',
      }
    },
  })
  async login(
    @Body() body: { email: string; password: string },
    @Res() res: Response,
  ) {
    console.log('body', body);
    const result = await this.authService.login(body);
    return res.status(200).json(result);
  }
  @Auth()
  @ApiOperation({ summary: 'Renueva el token de autenticación' })
  @Get('refresh-token') 
  async refreshToken(
    @Res() res: Response,
    @GetUser() user: any, 
  ) {
    const result = await this.authService.renewToken(user._id);
    delete user.password;
    console.log('user', user);
    return res.status(200).json({ user,token:result });
  }
}

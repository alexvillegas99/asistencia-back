import { Logger } from '@nestjs/common';
import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';

export const GetUser = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const logger = new Logger(GetUser.name);
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      logger.error(
        'No se ha encontrado el usuario en el request, revisar si el método usa el decorador de autenticación',
      );
      throw new InternalServerErrorException('No se ha encontrado el usuario');
    }

    return data ? user && user[data] : user;
  },
);

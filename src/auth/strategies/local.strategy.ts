import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-local';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  logger = new Logger(LocalStrategy.name);

  constructor(
   
    private config: ConfigService,
  ) {
    super({
      usernameField: 'nickname',
      passwordField: 'password',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, nickname: string, password: string) {
    this.logger.log('LocalAuthGuard is executed after the interceptor.');
   
  }
}

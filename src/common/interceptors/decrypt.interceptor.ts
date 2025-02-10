import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AppCliente } from 'src/encryption/enum/AppCliente.enum';
import { ConfigService } from '@nestjs/config';

import { EncryptionService } from 'src/encryption/encryption.service';

@Injectable()
export class DecryptionInterceptor implements NestInterceptor {
  logger: Logger = new Logger(DecryptionInterceptor.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    if (request.method !== 'GET') {
      request.body = this.encryptionService.decryption(request.body);
    }

    return next.handle().pipe(
      map((data) => {
        return data;
      }),
    );
  }
}

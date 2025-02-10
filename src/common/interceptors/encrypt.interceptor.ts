// encrypt.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { EncryptionService } from 'src/encryption/encryption.service';

@Injectable()
export class EncryptInterceptor implements NestInterceptor {
  constructor(private readonly encryptionService: EncryptionService) {}
  logger: Logger = new Logger(EncryptInterceptor.name);
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const dataToEncrypt = request.body;
    const client = request.headers.client;
    this.logger.log('client', client);
    const encryptedData = this.encryptionService.encryption(
      dataToEncrypt
    );
    request.body = { encryptedData };
    return next.handle().pipe(
      map((data) => {
        return data;
      }),
    );
  }
}

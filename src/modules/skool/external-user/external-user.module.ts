// src/modules/skool/external-user/external-user.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExternalUser, ExternalUserSchema } from './schemas/external-user.schema';
import { ExternalUserRepo } from './repos/external-user.repo';
import { ExternalUserService } from './external-user.service';
import { ExternalUserController } from './external-user.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ExternalUser.name, schema: ExternalUserSchema }]),
  ],
  controllers: [ExternalUserController],
  providers: [ExternalUserRepo, ExternalUserService],
  exports: [ExternalUserService, ExternalUserRepo],
})
export class ExternalUserModule {}

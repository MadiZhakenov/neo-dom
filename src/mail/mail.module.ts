// src\mail\mail.module.ts
import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

@Module({
  providers: [MailService],
  exports: [MailService], // Экспортируем сервис, чтобы его мог использовать AuthService
})
export class MailModule {}
/**
 * @file src/ai/ai.module.ts
 * @description Модуль, инкапсулирующий всю функциональность AI-ассистента.
 */

import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { UsersModule } from '../users/users.module';
import { PdfService } from './pdf/pdf.service';
import { DocumentsModule } from '../documents/documents.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  // Импортируем модули, сервисы из которых будут использоваться здесь
  imports: [UsersModule, DocumentsModule, ChatModule],
  // Регистрируем сервисы, которые принадлежат этому модулю
  providers: [AiService, PdfService],
  // Экспортируем AiService, чтобы его можно было использовать в других частях приложения (если потребуется)
  exports: [AiService],
  // Регистрируем контроллер этого модуля
  controllers: [AiController],
})
export class AiModule {}
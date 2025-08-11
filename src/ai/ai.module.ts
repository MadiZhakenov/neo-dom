/**
 * @file src/ai/ai.module.ts
 * @description Модуль, инкапсулирующий всю функциональность AI-ассистента.
 */

import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { UsersModule } from '../users/users.module';
import { PdfService } from './pdf/pdf.service';
import { DocumentsModule } from '../documents/documents.module';
import { ChatModule } from '../chat/chat.module';
import { ChatAiService } from './chat-ai.service';
import { DocumentAiService } from './document-ai.service';

import { TypeOrmModule } from '@nestjs/typeorm';
import { GeneratedDocument } from 'src/documents/entities/generated-document.entity';

@Module({
  // Импортируем модули, сервисы из которых будут использоваться здесь
  imports: [UsersModule, DocumentsModule, ChatModule, TypeOrmModule.forFeature([GeneratedDocument])],
  // Регистрируем сервисы, которые принадлежат этому модулю
  providers: [PdfService, ChatAiService, DocumentAiService],
  // Экспортируем AiService, чтобы его можно было использовать в других частях приложения (если потребуется)
  exports: [],
  // Регистрируем контроллер этого модуля
  controllers: [AiController],
})
export class AiModule { }
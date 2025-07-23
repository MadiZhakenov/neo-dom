/**
 * @file src/chat/chat.module.ts
 * @description Модуль, отвечающий за логику истории чата.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatHistoryService } from './history/history.service';
import { ChatMessage } from './entities/chat-message.entity';
import { User } from '../users/entities/user.entity';

@Module({
  // Регистрируем сущности, с которыми будет работать этот модуль
  imports: [TypeOrmModule.forFeature([ChatMessage, User])],
  providers: [ChatHistoryService],
  // Экспортируем сервис, чтобы его мог использовать AiModule
  exports: [ChatHistoryService],
})
export class ChatModule {}
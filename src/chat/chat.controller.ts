import { Controller, Get, UseGuards, Request, Header } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatHistoryService } from './history/history.service';
import { ChatType } from './entities/chat-message.entity';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatHistoryService: ChatHistoryService) {}

  /**
   * Эндпоинт для получения истории "ИИ-Чат" (общий чат).
   */
  @UseGuards(JwtAuthGuard)
  @Get('history/general')
  @Header('Cache-Control', 'no-store') // Добавляем заголовок для надежности
  async getGeneralChatHistory(@Request() req) {
    const userId = req.user.userId;
    return this.chatHistoryService.getHistoryForUser(userId, ChatType.GENERAL);
  }

  /**
   * Эндпоинт для получения истории "ИИ-Документы".
   */
  @UseGuards(JwtAuthGuard)
  @Get('history/document')
  @Header('Cache-Control', 'no-store')
  async getDocumentChatHistory(@Request() req) {
    const userId = req.user.userId;
    return this.chatHistoryService.getHistoryForUser(userId, ChatType.DOCUMENT);
  }
}
import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatHistoryService } from './history/history.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatHistoryService: ChatHistoryService) {}

  /**
   * Эндпоинт для получения полной истории чата текущего пользователя.
   */
  @UseGuards(JwtAuthGuard)
  @Get('history')
  async getChatHistory(@Request() req) {
    const userId = req.user.userId;
    return this.chatHistoryService.getHistoryForUser(userId);
  }
}
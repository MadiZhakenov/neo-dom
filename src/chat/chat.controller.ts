import { Controller, Get, UseGuards, Request, Header } from '@nestjs/common';
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
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async getChatHistory(@Request() req) {
    const userId = req.user.userId;
    return this.chatHistoryService.getHistoryForUser(userId);
  }
}
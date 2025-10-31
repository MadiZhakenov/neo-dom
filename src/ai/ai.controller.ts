import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Response } from 'express';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GenerateDocumentDto } from './dto/generate-document.dto';
import { DocxService } from '../documents/docx/docx.service';
import { ChatHistoryService } from '../chat/history/history.service'; 
import { ChatAiService } from './chat-ai.service';

@Controller('ai')
export class AiController {

  constructor(
    private readonly chatAiService: ChatAiService,
    private readonly usersService: UsersService,
    private readonly docxService: DocxService,
    private readonly chatHistoryService: ChatHistoryService
  ) { }

  @UseGuards(JwtAuthGuard)
  @Post('chat')
  async chatWithAssistant(@Request() req, @Body() generateDto: GenerateDocumentDto) {
    const userId = req.user.userId;
    const response = await this.chatAiService.getChatAnswer(generateDto.prompt, userId);
    return { aiResponse: response };
  }
}
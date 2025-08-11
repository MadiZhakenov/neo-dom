/**
 * @file src/ai/ai.controller.ts
 * @description Контроллер, отвечающий за обработку всех запросов к AI-ассистенту.
 * Является точкой входа для /ai/chat. Управляет состоянием диалога,
 * вызывает AI-сервис для получения ответов и генерации документов.
 */

import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  ForbiddenException,
  NotFoundException,
  Res,
  Param
} from '@nestjs/common';
import { Response } from 'express';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GenerateDocumentDto } from './dto/generate-document.dto';
import { DocxService } from '../documents/docx/docx.service';
import { User } from '../users/entities/user.entity';
import * as crypto from 'crypto';
import { TEMPLATES_REGISTRY } from './templates.registry';
import { ChatHistoryService } from 'src/chat/history/history.service';
import { ChatAiService } from './chat-ai.service'; // <-- НОВЫЙ СЕРВИС
import { DocumentAiService } from './document-ai.service'; // <-- НОВЫЙ СЕРВИС
import { ChatType } from 'src/chat/entities/chat-message.entity';

@Controller('ai')
export class AiController {
  /**
   * @param aiService Сервис для взаимодействия с моделями Google Gemini.
   * @param usersService Сервис для работы с данными пользователей.
   * @param docxService Сервис для генерации .docx файлов из шаблонов.
   */
  constructor(
    private readonly chatAiService: ChatAiService,
    private readonly documentAiService: DocumentAiService,
    private readonly usersService: UsersService,
    private readonly docxService: DocxService,
    private readonly chatHistoryService: ChatHistoryService
  ) { }

  /**
   * Эндпоинт для "ИИ-Чат".
   * Отвечает за ведение диалога, ответы на вопросы, RAG.
   */

  /**
   * Эндпоинт для "ИИ-Чат".
   */
  @UseGuards(JwtAuthGuard)
  @Post('chat')
  async chatWithAssistant(@Request() req, @Body() generateDto: GenerateDocumentDto) {
    const userId = req.user.userId;
    const response = await this.chatAiService.getChatAnswer(generateDto.prompt, userId);
    return { aiResponse: response };
  }

  @UseGuards(JwtAuthGuard)
  @Post('documents')
  async handleDocumentChat(
    @Request() req,
    @Body() generateDto: GenerateDocumentDto,
    @Res() res: Response,
  ) {
    const userId = req.user.userId;
    const user = await this.usersService.findOneById(userId);
    if (!user) { throw new NotFoundException('Пользователь не найден.'); }

    // --- НАЧАЛО ФИНАЛЬНОЙ, ПРАВИЛЬНОЙ ЛОГИКИ ---

    // 1. Получаем "сырой" ответ от AI-сервиса.
    const response = await this.documentAiService.processDocumentMessage(generateDto.prompt, user);

    if (response.type === 'file') {
      // --- ИСПРАВЛЕНИЕ: ДОБАВЛЯЕМ ПРОВЕРКУ ---
      if (!response.fileName) {
        // Этого не должно произойти, но добавляем для безопасности
        console.error("Ошибка: сервис вернул файл, но без имени файла.");
        return res.status(500).json({ aiResponse: "Внутренняя ошибка: отсутствует имя файла." });
      }

      const successMessage = `Документ "${response.fileName}" успешно сгенерирован.`;
      await this.chatHistoryService.addMessageToHistory(userId, generateDto.prompt, successMessage, ChatType.DOCUMENT);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(response.fileName)}.docx`);
      return res.send(response.content);
    }
  }
}
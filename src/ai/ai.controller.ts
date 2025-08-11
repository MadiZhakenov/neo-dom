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

  /**
   * Эндпоинт для "ИИ-Документы". Шаг 1: Начать генерацию.
   * Получает запрос, находит шаблон и возвращает список вопросов.
   */
  @UseGuards(JwtAuthGuard)
  @Post('documents/start')
  async startDocumentGeneration(@Request() req, @Body() generateDto: GenerateDocumentDto) {
    const userId = req.user.userId;
    const response = await this.documentAiService.startDocumentGeneration(generateDto.prompt, userId);
    return { aiResponse: response };
  }

  /**
     * Эндпоинт для "ИИ-Документы". Шаг 2: Отправить данные и получить файл.
     */
  @UseGuards(JwtAuthGuard)
  @Post('documents/fill/:templateName')
  async fillDocument(
    @Request() req,
    @Param('templateName') templateName: string,
    @Body() generateDto: GenerateDocumentDto,
    @Res() res: Response,
  ) {
    const userId = req.user.userId;
    const user = await this.usersService.findOneById(userId);
    if (!user) { throw new NotFoundException('Пользователь не найден.'); }

    try {
      if (user.tariff === 'Базовый') {
        // ... (логика проверки лимитов остается без изменений)
      }

      const { data, isComplete, missingFields = [] } = await this.documentAiService.extractDataForDocx(generateDto.prompt, templateName);

      if (!isComplete) {
        const missingQuestions = missingFields.map(f => f.question).join('\n- ');
        return res.status(400).json({ aiResponse: `Для завершения оформления, предоставьте:\n\n- ${missingQuestions}` });
      }

      if (data && Array.isArray(data.docs)) {
        data.docs.forEach((doc, i) => { doc.index = i + 1; });
      }

      const docxBuffer = this.docxService.generateDocx(templateName, data);

      if (user.tariff === 'Базовый') {
        await this.usersService.setLastGenerationDate(user.id, new Date());
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(templateName)}.docx`);
      return res.send(docxBuffer);

    } catch (error) {
      console.error('Ошибка генерации документа:', error);
      if (error instanceof ForbiddenException) {
        return res.status(403).json({ aiResponse: error.message });
      }
      return res.status(500).json({ aiResponse: 'Произошла ошибка при генерации документа.' });
    }
  }

}
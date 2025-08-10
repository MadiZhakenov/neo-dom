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
  Param,
} from '@nestjs/common';
import { Response } from 'express';
import { AiService } from './ai.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GenerateDocumentDto } from './dto/generate-document.dto';
import { DocxService } from '../documents/docx/docx.service';
import { User } from '../users/entities/user.entity';
import * as crypto from 'crypto';
import { TEMPLATES_REGISTRY } from './templates.registry';
import { ChatHistoryService } from 'src/chat/history/history.service';

@Controller('ai')
export class AiController {
  /**
   * @param aiService Сервис для взаимодействия с моделями Google Gemini.
   * @param usersService Сервис для работы с данными пользователей.
   * @param docxService Сервис для генерации .docx файлов из шаблонов.
   */
  constructor(
    private readonly aiService: AiService,
    private readonly usersService: UsersService,
    private readonly docxService: DocxService,
    private readonly chatHistoryService: ChatHistoryService
  ) {}

  /**
   * Эндпоинт для "ИИ-Чат".
   * Отвечает за ведение диалога, ответы на вопросы, RAG.
   */
  @UseGuards(JwtAuthGuard)
  @Post('chat')
  async chatWithAssistant(@Request() req, @Body() generateDto: GenerateDocumentDto) {
    const userId = req.user.userId;
    const response = await this.aiService.getChatAnswer(generateDto.prompt, userId);
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
    const response = await this.aiService.startDocumentGeneration(generateDto.prompt, userId);
    return { aiResponse: response };
  }

  /**
   * Эндпоинт для "ИИ-Документы". Шаг 2: Отправить данные и получить файл.
   * @param templateName Имя файла шаблона.
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
      // --- ПРОВЕРКА ЛИМИТОВ ---
      if (user.tariff === 'Базовый') {
        const now = new Date();
        const lastGen = user.last_generation_date;
        if (lastGen && lastGen.getMonth() === now.getMonth() && lastGen.getFullYear() === now.getFullYear()) {
          throw new ForbiddenException('Вы уже использовали свой лимит на генерацию документов в этом месяце.');
        }
      }

      // --- ИЗВЛЕЧЕНИЕ ДАННЫХ И ГЕНЕРАЦИЯ ---
      const { data, isComplete, missingFields = [] } = await this.aiService.extractDataForDocx(generateDto.prompt, templateName);

      if (!isComplete) {
        const missingQuestions = missingFields.map(f => f.question).join('\n- ');
        const responseMessage = `Для завершения оформления, пожалуйста, предоставьте следующую информацию:\n\n- ${missingQuestions}`;
        // Возвращаем ошибку с недостающими полями
        return res.status(400).json({ aiResponse: responseMessage, missingFields });
      }
      
      // Обогащение данных (например, нумерация)
      if (data && Array.isArray(data.docs)) {
        data.docs.forEach((doc, i) => { doc.index = i + 1; });
      }

      const docxBuffer = this.docxService.generateDocx(templateName, data);

      // Регистрация успешной попытки
      if (user.tariff === 'Базовый') {
        await this.usersService.setLastGenerationDate(user.id, new Date());
      }
      
      // Отправка файла
      const encodedFileName = encodeURIComponent(templateName);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}.docx`);
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
// src/ai/ai.controller.ts

import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  ForbiddenException,
  NotFoundException,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AiService } from './ai.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GenerateDocumentDto } from './dto/generate-document.dto';
import { DocxService } from '../documents/docx/docx.service';
import { UserChatState } from '../users/entities/user.entity';
import * as crypto from 'crypto';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly usersService: UsersService,
    private readonly docxService: DocxService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('chat')
  async chatWithAssistant(
    @Request() req,
    @Body() generateDto: GenerateDocumentDto,
    @Res() res: Response,
  ) {
    const userId = req.user.userId;
    const user = await this.usersService.findOneById(userId);
    if (!user) { throw new NotFoundException('Пользователь не найден.'); }

    if (user.tariff === 'Базовый') {
      const now = new Date();
      const lastGen = user.last_generation_date;
      if (!lastGen || lastGen.getMonth() !== now.getMonth() || lastGen.getFullYear() !== now.getFullYear()) {
        await this.usersService.resetGenerationCount(user.id);
        user.generation_count = 0;
      }
      if (user.generation_count >= 100) {
        throw new ForbiddenException('Превышен лимит сообщений для Базового тарифа.');
      }
    }
    await this.usersService.incrementGenerationCount(user.id);
    console.log(`[AI Controller] Входящий запрос. Состояние: ${user.chat_state}, Промпт: "${generateDto.prompt}", RequestId: ${generateDto.requestId}`);
    
    if (
      user.chat_state === UserChatState.WAITING_FOR_DATA &&
      user.pending_request_id &&
      generateDto.requestId === user.pending_request_id
    ) {
      const templateName = user.pending_template_name;
      if (!templateName) {
        await this.usersService.setChatState(userId, UserChatState.IDLE, null, null);
        res.status(400).json({ aiResponse: 'Ошибка состояния: шаблон не был выбран. Пожалуйста, начните заново.' });
        return;
      }
      
      console.log(`[AI Controller] Ветка: WAITING_FOR_DATA (RequestId совпал). Извлекаем данные для шаблона: ${templateName}`);
      
      try {
        const extractedData = await this.aiService.extractDataForDocx(generateDto.prompt, templateName);
        console.log('[AI Controller] Данные, извлеченные ИИ:', extractedData);
        
        const docxBuffer = this.docxService.generateDocx(templateName, extractedData);
        console.log('[AI Controller] DOCX буфер успешно сгенерирован.');
        
        await this.usersService.setChatState(userId, UserChatState.IDLE, null, null);
        console.log('[AI Controller] Состояние пользователя сброшено в IDLE.');
        
        const encodedFileName = encodeURIComponent(templateName);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
        res.send(docxBuffer);

      } catch (error) {
        console.error('[AI Controller] Ошибка на этапе генерации документа:', error);
        await this.usersService.setChatState(userId, UserChatState.IDLE, null, null);
        res.status(500).json({ aiResponse: 'Произошла внутренняя ошибка при генерации вашего документа. Попробуйте снова.' });
      }

    } else {
      console.log(`[AI Controller] Ветка: IDLE. Определяем намерение...`);
      const response = await this.aiService.getAiResponse(generateDto.prompt, userId);
      console.log('[AI Controller] Ответ от AiService:', response);
      if (response.type === 'start_generation') {
        const templateName = response.content;
        const fieldsToFill = await this.aiService.getFieldsForTemplate(templateName);
        const formattedQuestionsText = await this.aiService.formatQuestionsForUser(fieldsToFill, templateName);

        const requestId = crypto.randomBytes(16).toString('hex');
        
        await this.usersService.setChatState(userId, UserChatState.WAITING_FOR_DATA, templateName, requestId);
        console.log(`[AI Controller] Состояние пользователя изменено на WAITING_FOR_DATA. Шаблон: ${templateName}, RequestId: ${requestId}`);

        res.status(200).json({
          aiResponse: {
            action: 'collect_data',
            requestId: requestId, 
            questions: formattedQuestionsText,
          }
        });
      } else {
        res.status(200).json({ aiResponse: response.content });
      }
    }
  }
}
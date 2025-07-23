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
import { User } from '../users/entities/user.entity';
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

    // --- БЛОК ЛОГИКИ ТАРИФА ---
    if (user.tariff === 'Базовый') {
      const now = new Date();
      const lastGen = user.last_generation_date;
      if (!lastGen || lastGen.getMonth() !== now.getMonth() || lastGen.getFullYear() !== now.getFullYear()) {
        await this.usersService.resetGenerationCount(user.id);
      }
      if (user.generation_count >= 100) {
        throw new ForbiddenException('Превышен лимит сообщений для Базового тарифа.');
      }
    }
    await this.usersService.incrementGenerationCount(user.id);
    // --- КОНЕЦ БЛОКА ---


    // ===== НОВАЯ УМНАЯ ЛОГИКА УПРАВЛЕНИЯ ДИАЛОГОМ =====

    if (user.chat_state === UserChatState.WAITING_FOR_DATA) {
      // ИСПРАВЛЕНИЕ №1: Проверяем, что pending_template_name не null
      if (!user.pending_template_name) {
        // Это нештатная ситуация, сбрасываем состояние и просим пользователя начать заново
        console.error(`Ошибка состояния: пользователь ${userId} в WAITING_FOR_DATA, но pending_template_name отсутствует.`);
        await this.resetToChatMode(userId);
        return res.status(500).json({ aiResponse: 'Произошла внутренняя ошибка состояния. Пожалуйста, попробуйте начать заново.' });
      }

      const analysis = await this.aiService.analyzeInputDuringDataCollection(generateDto.prompt, user.pending_template_name);

      switch (analysis.intent) {
        case 'provide_data':
          return this.handleDocumentGeneration(user, generateDto, res);

        case 'switch_document':
          // ИСПРАВЛЕНИЕ №2: Проверяем, что AI вернул нам имя шаблона
          if (!analysis.templateName) {
            // Если AI не смог определить шаблон, действуем как при общем вопросе
            console.warn('AI определил смену документа, но не вернул имя шаблона.');
            await this.resetToChatMode(userId);
            const response = await this.aiService.getAiResponse(generateDto.prompt, userId);
            return res.status(200).json({ aiResponse: response.content });
          }

          const newTemplateName = analysis.templateName;
          const fields = await this.aiService.getFieldsForTemplate(newTemplateName);
          const questions = await this.aiService.formatQuestionsForUser(fields, newTemplateName);
          
          await this.usersService.setChatState(userId, UserChatState.WAITING_FOR_DATA, newTemplateName, user.pending_request_id);

          return res.status(200).json({
            aiResponse: {
              action: 'collect_data',
              requestId: user.pending_request_id,
              templateName: newTemplateName,
              questions: `Отлично, переключаемся на другой документ.\n\n${questions}`,
              instructions: `Пожалуйста, предоставьте данные для нового документа. Если хотите отменить, напишите "Отмена".`
            }
          });

        case 'general_query':
          await this.resetToChatMode(userId);
          const response = await this.aiService.getAiResponse(generateDto.prompt, userId);
          return res.status(200).json({ aiResponse: response.content });
      }
    }

    // Логика для обычного режима чата (остается без изменений)
    const response = await this.aiService.getAiResponse(generateDto.prompt, userId);

    if (response.type === 'start_generation') {
      const templateName = response.content;
      const fieldsToFill = await this.aiService.getFieldsForTemplate(templateName);
      const formattedQuestions = await this.aiService.formatQuestionsForUser(fieldsToFill, templateName);
      const requestId = crypto.randomBytes(16).toString('hex');

      await this.usersService.setChatState(userId, UserChatState.WAITING_FOR_DATA, templateName, requestId);

      return res.status(200).json({
        aiResponse: {
          action: 'collect_data',
          requestId: requestId,
          templateName: templateName,
          questions: formattedQuestions,
          instructions: `Пожалуйста, предоставьте данные для документа. Если хотите отменить, напишите "Отмена".`
        }
      });
    }

    return res.status(200).json({ aiResponse: response.content });
  }

  private isDocumentDataRequest(prompt: string): boolean {
    const documentKeywords = [
      'адрес', 'организация', 'реквизиты', 'дата', 
      'подписание', 'документ', 'указать', 'предоставить'
    ];
    return documentKeywords.some(keyword => 
      prompt.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  
  private async handleDocumentGeneration(
    user: User,
    generateDto: GenerateDocumentDto,
    res: Response
  ) {
    try {
      if (!user.pending_template_name) {
        throw new Error('Не указан шаблон документа');
      }
  
      const { data, isComplete, missingFields = [] } = await this.aiService.extractDataForDocx(
        generateDto.prompt,
        user.pending_template_name
      );
  
      if (!isComplete) {
        const missingQuestions = missingFields.map(f => f.question).join('\n- ');
        
        return res.status(200).json({
          aiResponse: `Для завершения оформления документа, пожалуйста, предоставьте следующую информацию:\n\n- ${missingQuestions}\n\nОтправьте все данные ОДНИМ сообщением в указанном формате.`,
          action: 'collect_data',
          templateName: user.pending_template_name
        });
      }
  
      const docxBuffer = this.docxService.generateDocx(user.pending_template_name, data);
      await this.usersService.setChatState(user.id, UserChatState.IDLE, null, null);
  
      const encodedFileName = encodeURIComponent(user.pending_template_name);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
      return res.send(docxBuffer);
  
    } catch (error) {
      console.error('Ошибка генерации документа:', error);
      await this.usersService.setChatState(user.id, UserChatState.IDLE, null, null);
      return res.status(500).json({ 
        aiResponse: 'Произошла ошибка при генерации документа. Пожалуйста, попробуйте снова.' 
      });
    }
  }
  private async resetToChatMode(userId: number) {
    await this.usersService.setChatState(
      userId,
      UserChatState.IDLE,
      null,
      null
    );
  }
  private isCancellationRequest(prompt: string): boolean {
    const lowerCasePrompt = prompt.toLowerCase();
    return lowerCasePrompt.includes('отмена') || lowerCasePrompt.includes('cancel');
}
}
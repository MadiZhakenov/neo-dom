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

    // --- БЛОК ЛОГИКИ ТАРИФА (остается без изменений) ---
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
    // --- КОНЕЦ БЛОКА ЛОГИКИ ТАРИФА ---

    // УЛУЧШЕННАЯ ЛОГИКА ОБРАБОТКИ СОСТОЯНИЙ
    // Проверяем, не хочет ли пользователь отменить действие, ВНЕ зависимости от текущего состояния
    if (this.isCancellationRequest(generateDto.prompt)) {
        await this.resetToChatMode(userId);
        return res.status(200).json({
            aiResponse: 'Режим заполнения документа отменен. Чем еще могу помочь?'
        });
    }

    // Если мы в режиме сбора данных
    if (user.chat_state === UserChatState.WAITING_FOR_DATA) {
        // ... то передаем управление специальному обработчику
        return this.handleDocumentGeneration(user, generateDto, res);
    }

    // Стандартный флоу: определяем намерение и отвечаем
    const response = await this.aiService.getAiResponse(generateDto.prompt, userId);

    if (response.type === 'start_generation') {
        const templateName = response.content;
        const fieldsToFill = await this.aiService.getFieldsForTemplate(templateName);
        const formattedQuestions = await this.aiService.formatQuestionsForUser(fieldsToFill, templateName);
        const requestId = crypto.randomBytes(16).toString('hex');

        await this.usersService.setChatState(
            userId,
            UserChatState.WAITING_FOR_DATA,
            templateName,
            requestId,
        );

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
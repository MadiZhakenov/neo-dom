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
import { TEMPLATES_REGISTRY } from './templates.registry';

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

  
    if (user.chat_state === UserChatState.WAITING_FOR_DATA) {
      if (!user.pending_template_name) {
        console.error(`Ошибка состояния: пользователь ${userId} в WAITING_FOR_DATA, но pending_template_name отсутствует.`);
        await this.resetToChatMode(userId);
        return res.status(500).json({ aiResponse: 'Произошла внутренняя ошибка состояния. Пожалуйста, попробуйте начать заново.' });
      }
  
      const analysis = await this.aiService.analyzeInputDuringDataCollection(generateDto.prompt, user.pending_template_name);
  
      switch (analysis.intent) {
        case 'provide_data':
          return this.handleDocumentGeneration(user, generateDto, res);
  
        case 'switch_document':
          if (!analysis.templateName) {
            console.warn('AI определил смену документа, но не вернул имя шаблона.');
            await this.resetToChatMode(userId);
            const response = await this.aiService.getAiResponse(generateDto.prompt, userId);
            return res.status(200).json({ aiResponse: response.content });
          }
  
          const newTemplateName = analysis.templateName;
          // Получаем язык нового шаблона
          const newTemplateLanguage = TEMPLATES_REGISTRY[newTemplateName]?.language || 'ru';
          const fields = await this.aiService.getFieldsForTemplate(newTemplateName);
          const questions = await this.aiService.formatQuestionsForUser(fields, newTemplateName);
          
          await this.usersService.setChatState(userId, UserChatState.WAITING_FOR_DATA, newTemplateName, user.pending_request_id);
  
          return res.status(200).json({
            aiResponse: {
              action: 'collect_data',
              requestId: user.pending_request_id,
              templateName: newTemplateName,
              questions: `Отлично, переключаемся на другой документ.\n\n${questions}`,
              // ИСПРАВЛЕНИЕ №1: Инструкция теперь зависит от языка
              instructions: newTemplateLanguage === 'kz'
                ? 'Жаңа құжат үшін деректерді енгізіңіз. Бас тарту үшін "Болдырмау" деп жазыңыз.'
                : 'Пожалуйста, предоставьте данные для нового документа. Если хотите отменить, напишите "Отмена".'
            }
          });
  
        case 'general_query':
          await this.resetToChatMode(userId);
          const response = await this.aiService.getAiResponse(generateDto.prompt, userId);
          return res.status(200).json({ aiResponse: response.content });
      }
    }
  
    // Логика для обычного режима чата
    const response = await this.aiService.getAiResponse(generateDto.prompt, userId);
  
    if (response.type === 'start_generation') {
      const templateName = response.content;
      // Получаем язык выбранного шаблона
      const templateLanguage = TEMPLATES_REGISTRY[templateName]?.language || 'ru';
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
          // ИСПРАВЛЕНИЕ №2: Инструкция теперь зависит от языка
          instructions: templateLanguage === 'kz'
              ? 'Құжат үшін деректерді енгізіңіз. Бас тарту үшін "Болдырмау" деп жазыңыз.'
              : 'Пожалуйста, предоставьте данные для документа. Если хотите отменить, напишите "Отмена".'
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

  
  private async handleDocumentGeneration(user: User, generateDto: GenerateDocumentDto, res: Response) {
    try {
      if (user.tariff === 'Базовый') {
        const now = new Date();
        const lastGen = user.last_generation_date;

        if (lastGen && lastGen.getMonth() === now.getMonth() && lastGen.getFullYear() === now.getFullYear()) {
          const lang = this.aiService.detectLanguage(generateDto.prompt);
          const errorMessage = lang === 'kz'
            ? 'Сіз осы айдағы құжат жасау лимитіңізді пайдаланып қойдыңыз. "Премиум" тарифіне өтіп, шектеусіз мүмкіндіктерге ие болыңыз.'
            : 'Вы уже использовали свой лимит на генерацию документов в этом месяце. Перейдите на тариф "Премиум" для неограниченных возможностей.';
          throw new ForbiddenException(errorMessage);
        }
      }

      const { data, isComplete, missingFields = [] } = await this.aiService.extractDataForDocx(
        generateDto.prompt,
        user.pending_template_name!,
      );

      if (!isComplete) {
        const templateLanguage = TEMPLATES_REGISTRY[user.pending_template_name!]?.language || 'ru';
        const missingQuestions = missingFields.map(f => f.question).join('\n- ');
        const responseMessage = templateLanguage === 'kz'
          ? `Құжатты рәсімдеуді аяқтау үшін келесі ақпаратты беріңіз:\n\n- ${missingQuestions}\n\nБарлық деректерді КӨРСЕТІЛГЕН форматта БІР хабарламамен жіберіңіз.`
          : `Для завершения оформления документа, пожалуйста, предоставьте следующую информацию:\n\n- ${missingQuestions}\n\nОтправьте все данные ОДНИМ сообщением в указанном формате.`;
        return res.status(200).json({
          aiResponse: responseMessage,
          action: 'collect_data',
          templateName: user.pending_template_name,
        });
      }

      // ================================================================
      // === ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ: ДОБАВЛЯЕМ НУМЕРАЦИЮ ПРОГРАММНО ===
      // ================================================================
      // Проверяем, есть ли в данных массив 'docs' (или другой ключ для вашей таблицы)
      if (data && Array.isArray(data.docs)) {
        // Проходим по массиву и добавляем поле 'index'
        data.docs.forEach((doc, i) => {
          doc.index = i + 1; // i начинается с 0, поэтому добавляем 1
        });
      }
      // ================================================================

      // Генерируем документ уже с модифицированными данными
      const docxBuffer = this.docxService.generateDocx(user.pending_template_name!, data);

      if (user.tariff === 'Базовый') {
          await this.usersService.setLastGenerationDate(user.id, new Date());
      }

      await this.resetToChatMode(user.id);
      
      const encodedFileName = encodeURIComponent(user.pending_template_name!);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}.docx`);
      return res.send(docxBuffer);

    } catch (error) {
      if (error instanceof ForbiddenException) {
          return res.status(403).json({ aiResponse: error.message });
      }
      console.error('Ошибка генерации документа:', error);
      await this.resetToChatMode(user.id);
      return res.status(500).json({
        aiResponse: 'Произошла ошибка при генерации документа. Пожалуйста, попробуйте снова.',
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
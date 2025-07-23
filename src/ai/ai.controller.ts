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
} from '@nestjs/common';
import { Response } from 'express';
import { AiService } from './ai.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GenerateDocumentDto } from './dto/generate-document.dto';
import { DocxService } from '../documents/docx/docx.service';
import { UserChatState, User } from '../users/entities/user.entity';
import * as crypto from 'crypto';
import { TEMPLATES_REGISTRY } from './templates.registry';

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
  ) {}

  /**
   * Основной метод для ведения диалога с AI.
   * Обрабатывает все входящие сообщения, управляет состояниями
   * и вызывает соответствующие методы для генерации ответа или документа.
   * @param req - Запрос, содержащий данные аутентифицированного пользователя.
   * @param generateDto - DTO с промптом пользователя.
   * @param res - Объект ответа Express для отправки данных.
   */
  @UseGuards(JwtAuthGuard)
  @Post('chat')
  async chatWithAssistant(
    @Request() req,
    @Body() generateDto: GenerateDocumentDto,
    @Res() res: Response,
  ) {
    const userId = req.user.userId;
    const user = await this.usersService.findOneById(userId);
    if (!user) {
      throw new NotFoundException('Пользователь не найден.');
    }

    // === ЛОГИКА УПРАВЛЕНИЯ ДИАЛОГОМ ===

    // 1. Если пользователь находится в состоянии "ожидания данных" для документа.
    if (user.chat_state === UserChatState.WAITING_FOR_DATA) {
      // Защита от непредвиденной ошибки состояния.
      if (!user.pending_template_name) {
        console.error(`Ошибка состояния: пользователь ${userId} в WAITING_FOR_DATA, но pending_template_name отсутствует.`);
        await this.resetToChatMode(userId);
        return res.status(500).json({ aiResponse: 'Произошла внутренняя ошибка состояния. Пожалуйста, попробуйте начать заново.' });
      }

      // Анализируем намерение пользователя: предоставляет ли он данные, хочет сменить документ или задает общий вопрос.
      const analysis = await this.aiService.analyzeInputDuringDataCollection(generateDto.prompt, user.pending_template_name);

      switch (analysis.intent) {
        // 1.1. Пользователь предоставляет данные -> передаем управление генератору документов.
        case 'provide_data':
          return this.handleDocumentGeneration(user, generateDto, res);

        // 1.2. Пользователь хочет сменить документ -> выполняем бесшовное переключение.
        case 'switch_document':
          if (!analysis.templateName) {
            console.warn('AI определил смену документа, но не вернул имя шаблона. Сбрасываем в чат.');
            await this.resetToChatMode(userId);
            const response = await this.aiService.getAiResponse(generateDto.prompt, userId);
            return res.status(200).json({ aiResponse: response.content });
          }

          const newTemplateName = analysis.templateName;
          const newTemplateLanguage = TEMPLATES_REGISTRY[newTemplateName]?.language || 'ru';
          const fields = await this.aiService.getFieldsForTemplate(newTemplateName);
          const questions = await this.aiService.formatQuestionsForUser(fields, newTemplateName);
          
          // Обновляем состояние пользователя, меняя шаблон, но сохраняя ID запроса.
          await this.usersService.setChatState(userId, UserChatState.WAITING_FOR_DATA, newTemplateName, user.pending_request_id);

          // Отправляем пользователю новые вопросы и локализованные инструкции.
          return res.status(200).json({
            aiResponse: {
              action: 'collect_data',
              requestId: user.pending_request_id,
              templateName: newTemplateName,
              questions: `Отлично, переключаемся на другой документ.\n\n${questions}`,
              instructions: newTemplateLanguage === 'kz'
                ? 'Жаңа құжат үшін деректерді енгізіңіз. Бас тарту үшін "Болдырмау" деп жазыңыз.'
                : 'Пожалуйста, предоставьте данные для нового документа. Если хотите отменить, напишите "Отмена".'
            }
          });

        // 1.3. Пользователь задал общий вопрос или хочет отменить действие.
        case 'general_query':
          await this.resetToChatMode(userId);
          const response = await this.aiService.getAiResponse(generateDto.prompt, userId);
          return res.status(200).json({ aiResponse: response.content });
      }
    }

    // 2. Логика для обычного режима чата (когда пользователь не заполняет документ).
    const response = await this.aiService.getAiResponse(generateDto.prompt, userId);

    // Если AI определил, что нужно начать генерацию документа.
    if (response.type === 'start_generation') {
      const templateName = response.content;
      const templateLanguage = TEMPLATES_REGISTRY[templateName]?.language || 'ru';
      const fieldsToFill = await this.aiService.getFieldsForTemplate(templateName);
      const formattedQuestions = await this.aiService.formatQuestionsForUser(fieldsToFill, templateName);
      const requestId = crypto.randomBytes(16).toString('hex');

      // Переводим пользователя в состояние ожидания данных.
      await this.usersService.setChatState(userId, UserChatState.WAITING_FOR_DATA, templateName, requestId);

      // Отправляем первый набор вопросов.
      return res.status(200).json({
        aiResponse: {
          action: 'collect_data',
          requestId: requestId,
          templateName: templateName,
          questions: formattedQuestions,
          instructions: templateLanguage === 'kz'
              ? 'Құжат үшін деректерді енгізіңіз. Бас тарту үшін "Болдырмау" деп жазыңыз.'
              : 'Пожалуйста, предоставьте данные для документа. Если хотите отменить, напишите "Отмена".'
        }
      });
    }

    // Если это обычный ответ в чате, просто отправляем его.
    return res.status(200).json({ aiResponse: response.content });
  }

  /**
   * Приватный метод, который обрабатывает финальный этап - генерацию документа.
   * Вызывается, когда пользователь предоставил данные.
   * Проверяет тарифные лимиты, извлекает данные, генерирует файл и отправляет его пользователю.
   * @param user - Объект пользователя.
   * @param generateDto - DTO с данными от пользователя.
   * @param res - Объект ответа Express.
   */
  private async handleDocumentGeneration(user: User, generateDto: GenerateDocumentDto, res: Response) {
    try {
      // 1. ПРОВЕРКА ТАРИФА И ЛИМИТА НА ГЕНЕРАЦИЮ
      if (user.tariff === 'Базовый') {
        const now = new Date();
        const lastGen = user.last_generation_date;

        // Если последняя генерация была в текущем месяце, запрещаем новую.
        if (lastGen && lastGen.getMonth() === now.getMonth() && lastGen.getFullYear() === now.getFullYear()) {
          const lang = this.aiService.detectLanguage(generateDto.prompt);
          const errorMessage = lang === 'kz'
            ? 'Сіз осы айдағы құжат жасау лимитіңізді пайдаланып қойдыңыз. "Премиум" тарифіне өтіп, шектеусіз мүмкіндіктерге ие болыңыз.'
            : 'Вы уже использовали свой лимит на генерацию документов в этом месяце. Перейдите на тариф "Премиум" для неограниченных возможностей.';
          throw new ForbiddenException(errorMessage);
        }
      }

      // 2. ИЗВЛЕЧЕНИЕ ДАННЫХ ИЗ ПРОМПТА ПОЛЬЗОВАТЕЛЯ
      const { data, isComplete, missingFields = [] } = await this.aiService.extractDataForDocx(
        generateDto.prompt,
        user.pending_template_name!,
      );

      // Если AI счел, что данных не хватает, запрашиваем их снова.
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
      
      // 3. ПРОГРАММНОЕ ОБОГАЩЕНИЕ ДАННЫХ (добавление нумерации для таблиц)
      if (data && Array.isArray(data.docs)) {
        data.docs.forEach((doc, i) => {
          doc.index = i + 1;
        });
      }

      // 4. ГЕНЕРАЦИЯ ФАЙЛА
      const docxBuffer = this.docxService.generateDocx(user.pending_template_name!, data);

      // 5. РЕГИСТРАЦИЯ УСПЕШНОЙ ПОПЫТКИ (только после генерации файла)
      if (user.tariff === 'Базовый') {
          await this.usersService.setLastGenerationDate(user.id, new Date());
      }

      // 6. СБРОС СОСТОЯНИЯ И ОТПРАВКА ФАЙЛА
      await this.resetToChatMode(user.id);
      
      const encodedFileName = encodeURIComponent(user.pending_template_name!);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}.docx`);
      return res.send(docxBuffer);

    } catch (error) {
      // 7. ОБРАБОТКА ОШИБОК
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

  /**
   * Вспомогательный метод для сброса состояния чата пользователя в IDLE.
   * @param userId - ID пользователя.
   */
  private async resetToChatMode(userId: number) {
    await this.usersService.setChatState(
      userId,
      UserChatState.IDLE,
      null,
      null
    );
  }
}
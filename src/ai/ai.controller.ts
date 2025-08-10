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
    console.log(`[Controller] Получен запрос от userId: ${userId}`);
    const user = await this.usersService.findOneById(userId);
    if (!user) {
      throw new NotFoundException('Пользователь не найден.');
    }

    if (user.chat_state === UserChatState.WAITING_FOR_DATA) {
      if (!user.pending_template_name) {
        console.error(`Критическая ошибка состояния: пользователь ${user.id} в WAITING_FOR_DATA, но pending_template_name отсутствует.`);
        await this.resetToChatMode(userId);
        return res.status(500).json({ aiResponse: 'Произошла внутренняя ошибка состояния. Пожалуйста, попробуйте начать заново.' });
      }
      const analysis = await this.aiService.analyzeInputDuringDataCollection(generateDto.prompt, user.pending_template_name);
      switch (analysis.intent) {
        // 1.1. Пользователь предоставляет данные -> передаем управление генератору документов.
        case 'provide_data':
          return this.handleDocumentGeneration(user, generateDto, res);

        // 1.2. Пользователь хочет сменить документ (или повторно запрашивает тот же).
        case 'switch_document':
          console.log(`[Controller] Пользователь в состоянии WAITING_FOR_DATA запросил новый документ. Сбрасываю состояние и начинаю заново.`);
          // Сбрасываем состояние, чтобы выйти из режима "ожидания данных".
          await this.resetToChatMode(userId);
          // Просто вызываем этот же метод `chatWithAssistant` еще раз.
          // Теперь, когда состояние сброшено, запрос пойдет по стандартной ветке,
          // как будто это новый диалог. Это предотвращает "поломку".
          return this.chatWithAssistant(req, generateDto, res);

        // 1.3. Пользователь задал общий вопрос или хочет отменить действие.
        case 'general_query':
          console.log(`[Controller] Пользователь в состоянии WAITING_FOR_DATA задал общий вопрос. Сбрасываю состояние.`);
          await this.resetToChatMode(userId);
          const queryResponse = await this.aiService.getAiResponse(generateDto.prompt, user.id);
          return res.status(200).json({ aiResponse: queryResponse.content });
      }
    }

    
    // 2. Логика для обычного режима чата (когда пользователь не заполняет документ).
    const response = await this.aiService.getAiResponse(generateDto.prompt, user.id);
    console.log(`[Controller] Получен ответ от AiService, отправляю клиенту.`);

    // Если AI определил, что нужно начать генерацию документа.
    if (response.type === 'start_generation') {
      const templateName = response.content;
      const fieldsToFill = await this.aiService.getFieldsForTemplate(templateName);
      const formattedQuestions = await this.aiService.formatQuestionsForUser(fieldsToFill, templateName);
      const requestId = crypto.randomBytes(16).toString('hex');

      // Переводим пользователя в состояние ожидания данных.
      await this.usersService.setChatState(user.id, UserChatState.WAITING_FOR_DATA, templateName, requestId);

      const responsePayload = {
        action: 'collect_data',
        requestId: requestId,
        templateName: templateName,
        questions: formattedQuestions,
        instructions: TEMPLATES_REGISTRY[templateName]?.language === 'kz'
          ? 'Құжат үшін деректерді енгізіңіз. Бас тарту үшін "Болдырмау" деп жазыңыз.'
          : 'Пожалуйста, предоставьте данные для документа. Если хотите отменить, напишите "Отмена".',
      };

      await this.chatHistoryService.addMessageToHistory(userId, generateDto.prompt, JSON.stringify(responsePayload));
      return res.status(200).json({ aiResponse: responsePayload });
    }
    else{
      // return res.status(200).json({ aiResponse: response.content });
      // Это обычный текстовый ответ.
      const chatResponse = response.content;
      
      // --- ПРАВИЛЬНО: Сохраняем в историю текстовый ответ ---
      await this.chatHistoryService.addMessageToHistory(userId, generateDto.prompt, chatResponse);
      
      return res.status(200).json({ aiResponse: chatResponse });
    }
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
      // Проверяем, не истекла ли премиум-подписка
      if (user.tariff === 'Премиум' && user.subscription_expires_at && user.subscription_expires_at < new Date()) {
        console.log(`Премиум-подписка для пользователя ${user.id} истекла. Меняем тариф на Базовый.`);
        // Деактивируем премиум и обновляем объект user для этого запроса
        await this.usersService.deactivatePremium(user.id);
        user.tariff = 'Базовый'; 
      }
      
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
        
        // --- НОВАЯ УМНАЯ ЛОГИКА ---
        // Получаем ПОЛНУЮ историю чата
        const history = await this.chatHistoryService.getHistoryForUser(user.id);
        // Находим последнее сообщение от МОДЕЛИ
        const lastModelMessage = history.filter(m => m.role === 'model').pop();

        // Проверяем, что последнее сообщение существует
        if (lastModelMessage) {
            try {
              // Пытаемся распарсить последнее сообщение как JSON
              const lastResponsePayload = JSON.parse(lastModelMessage.content);
              // Если это был JSON с вопросами, то просто вежливо повторяем его.
              if (lastResponsePayload && lastResponsePayload.action === 'collect_data') {
                const lang = this.aiService.detectLanguage(generateDto.prompt);
                const politeReminder = lang === 'kz' 
                  ? 'Мен сізден әлі де келесі ақпаратты күтіп отырмын:\n\n' 
                  : 'Я все еще ожидаю от вас информацию по следующим пунктам:\n\n';
                
                // Создаем новый payload, чтобы не изменять старый
                const reminderPayload = {
                  ...lastResponsePayload,
                  questions: `${politeReminder}${lastResponsePayload.questions}`
                };
                
                // Сохраняем в историю наше новое сообщение-напоминание
                await this.chatHistoryService.addMessageToHistory(user.id, generateDto.prompt, JSON.stringify(reminderPayload));
                return res.status(200).json({ aiResponse: reminderPayload });
              }
            } catch (e) {
              // Если последнее сообщение не было JSON, значит, это был обычный чат,
              // и мы просто продолжаем выполнение кода ниже.
              console.log('[Controller] Последнее сообщение модели не было JSON, генерируем новый список вопросов.');
            }
        }
        // Если AI смог определить, каких полей не хватает, генерируем новое сообщение.
        // Этот блок сработает, если AI вернул isComplete: false с конкретными missingFields,
        // или если последнее сообщение в истории не было JSON-запросом данных.
        const templateLanguage = TEMPLATES_REGISTRY[user.pending_template_name!]?.language || 'ru';
        const missingQuestions = missingFields.map(f => f.question).join('\n- ');
        const responseMessage = `Для завершения оформления документа, пожалуйста, предоставьте следующую информацию:\n\n- ${missingQuestions}`;
        
        await this.chatHistoryService.addMessageToHistory(user.id, generateDto.prompt, responseMessage);
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
/**
 * @file src/chat/history/history.service.ts
 * @description Сервис для управления историей сообщений в чате с разделением по типам.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage, ChatMessageRole, ChatType } from '../entities/chat-message.entity';
import { User } from '../../users/entities/user.entity';
import { Content } from '@google/generative-ai';

@Injectable()
export class ChatHistoryService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly chatMessageRepository: Repository<ChatMessage>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) { }

  /**
   * Получает историю для конкретного типа чата.
   * @param userId - ID пользователя.
   * @param type - Тип чата ('chat' или 'document').
   */
  async getHistory(userId: number, type: ChatType): Promise<Content[]> {
    const messages = await this.chatMessageRepository.find({
      where: { user: { id: userId }, type: type }, // <-- Фильтруем по типу
      order: { createdAt: 'DESC' },
      take: 20,
    });

    if (messages.length === 0) return [];

    const sortedMessages = messages.reverse();
    const firstUserIndex = sortedMessages.findIndex(msg => msg.role === ChatMessageRole.USER);
    if (firstUserIndex === -1) return [];

    const validHistory = sortedMessages.slice(firstUserIndex);
    return validHistory.map((msg) => ({
      role: msg.role as 'user' | 'model',
      parts: [{ text: msg.content }],
    }));
  }

  /**
   * Добавляет пару сообщений в историю для конкретного типа чата.
   * @param userId - ID пользователя.
   * @param userContent - Сообщение пользователя.
   * @param modelContent - Ответ модели.
   * @param type - Тип чата.
   */
  async addMessageToHistory(userId: number, userContent: string, modelContent: string, type: ChatType): Promise<void> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      console.error(`Попытка добавить историю для несуществующего пользователя с ID: ${userId}`);
      return;
    }

    const userMessage = this.chatMessageRepository.create({
      user,
      role: ChatMessageRole.USER,
      content: userContent,
      type: type, // <-- Указываем тип
    });

    const modelMessage = this.chatMessageRepository.create({
      user,
      role: ChatMessageRole.MODEL,
      content: modelContent,
      type: type, // <-- Указываем тип
    });

    await this.chatMessageRepository.save([userMessage, modelMessage]);
  }

  /**
   * Получает историю для фронтенда для конкретного типа чата.
   * @param userId - ID пользователя.
   * @param type - Тип чата.
   */
  async getHistoryForUser(userId: number, type: ChatType) {
    const messages = await this.chatMessageRepository.find({
      where: { user: { id: userId }, type: type }, // <-- Фильтруем по типу
      order: { createdAt: 'ASC' },
      take: 50,
    });

    // Если история пуста И это чат для документов, создаем первое сообщение
    if (messages.length === 0 && type === ChatType.DOCUMENT) {
      const user = await this.userRepository.findOneBy({ id: userId });
      if (!user) {
        // На случай, если пользователь удален, но токен еще жив
        return [];
      }

      const welcomeMessageContent =
        `👋 Привет! Я — ваш ИИ-помощник по созданию документов.

Я могу помочь вам быстро и легко подготовить нужный документ по стандартам.

📝 **Как это работает?**
Просто напишите мне название документа, который вы хотите создать. Например: **"Хочу оформить акт приема-передачи"**.

Я задам вам несколько уточняющих вопросов, а после получения всех данных — сгенерирую для вас готовый Word-файл! 📄

🚀 Давайте начнем!`;

      const welcomeMessage = this.chatMessageRepository.create({
        user,
        role: ChatMessageRole.MODEL,
        content: welcomeMessageContent,
        type: ChatType.DOCUMENT, // Важно указать правильный тип чата
      });

      await this.chatMessageRepository.save(welcomeMessage);

      // Возвращаем новое сообщение в том же формате, что и остальные
      return [{
        role: welcomeMessage.role,
        content: welcomeMessage.content,
        createdAt: welcomeMessage.createdAt,
      }];
    }


    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt,
    }));
  }

  /**
 * Находит последнее сообщение пользователя и обновляет следующее за ним (пустое) сообщение модели.
 * @param userId - ID пользователя.
 *-  @param modelContent - Текст ответа модели для сохранения.
 * @param type - Тип чата.
 */
  async updateLastModelMessage(userId: number, modelContent: string, type: ChatType): Promise<void> {
    // 1. Находим самое последнее сообщение в чате для этого пользователя и типа
    const lastMessage = await this.chatMessageRepository.findOne({
      where: {
        user: { id: userId },
        type: type,
      },
      order: { createdAt: 'DESC' },
    });

    // 2. Проверяем, что это сообщение от пользователя и у него пустой ответ
    if (lastMessage && lastMessage.role === ChatMessageRole.USER) {
      // Это условие означает, что мы только что сохранили сообщение пользователя,
      // а сообщение модели для него еще не создано.
      // (В нашей новой логике мы сохраняем user message с пустым model message,
      // но для надежности лучше создать новое сообщение модели).

      const modelMessage = this.chatMessageRepository.create({
        user: lastMessage.user,
        role: ChatMessageRole.MODEL,
        content: modelContent,
        type: type,
      });
      await this.chatMessageRepository.save(modelMessage);

    } else if (lastMessage && lastMessage.role === ChatMessageRole.MODEL) {
      // Если последнее сообщение уже от модели, просто обновим его
      lastMessage.content = modelContent;
      await this.chatMessageRepository.save(lastMessage);
    } else {
      console.error(`[HistoryService] Не найдено предыдущее сообщение для обновления ответа модели для userId: ${userId}`);
    }
  }
}
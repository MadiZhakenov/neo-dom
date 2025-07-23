/**
 * @file src/chat/history/history.service.ts
 * @description Сервис для управления историей сообщений в чате.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage, ChatMessageRole } from '../entities/chat-message.entity';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class ChatHistoryService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly chatMessageRepository: Repository<ChatMessage>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Получает последние 10 сообщений из истории чата пользователя.
   * Форматирует их в вид, понятный для Google Gemini API.
   * @param userId - ID пользователя.
   * @returns Массив сообщений в формате для AI.
   */
  async getHistory(userId: number): Promise<{ role: string; parts: { text: string }[] }[]> {
    const messages = await this.chatMessageRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'ASC' },
      take: 10, // Ограничиваем историю для экономии токенов
    });

    // Защита от некорректной истории (когда первое сообщение от модели)
    if (messages.length > 0 && messages[0].role === ChatMessageRole.MODEL) {
      console.warn(`[History Service] Обнаружена некорректная история: первое сообщение от модели (userId: ${userId}). История будет проигнорирована.`);
      return [];
    }

    return messages.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));
  }

  /**
   * Добавляет пару сообщений (от пользователя и от модели) в историю чата.
   * @param userId - ID пользователя.
   * @param userContent - Текст сообщения от пользователя.
   * @param modelContent - Текст ответа от AI.
   */
  async addMessageToHistory(userId: number, userContent: string, modelContent: string): Promise<void> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      console.error(`Попытка добавить историю для несуществующего пользователя с ID: ${userId}`);
      return;
    }

    const userMessage = this.chatMessageRepository.create({
      user: user,
      role: ChatMessageRole.USER,
      content: userContent,
    });

    const modelMessage = this.chatMessageRepository.create({
      user: user,
      role: ChatMessageRole.MODEL,
      content: modelContent,
    });

    await this.chatMessageRepository.save([userMessage, modelMessage]);
  }
}
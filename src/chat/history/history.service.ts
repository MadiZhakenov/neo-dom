/**
 * @file src/chat/history/history.service.ts
 * @description Сервис для управления историей сообщений в чате.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage, ChatMessageRole } from '../entities/chat-message.entity';
import { User } from '../../users/entities/user.entity';
import { Content } from '@google/generative-ai';

@Injectable()
export class ChatHistoryService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly chatMessageRepository: Repository<ChatMessage>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Получает последние сообщения и форматирует их для Google Gemini API.
   * Обеспечивает правильное чередование ролей.
   * @param userId - ID пользователя.
   * @returns Массив сообщений в формате для AI.
   */
  async getHistory(userId: number): Promise<Content[]> {
    // 1. Запрашиваем чуть больше сообщений, чтобы было из чего выбирать
    const messages = await this.chatMessageRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' }, // Сортируем от НОВЫХ к СТАРЫМ
      take: 20, // Берем последние 20
    });

    if (messages.length === 0) {
      return [];
    }
    
    // Переворачиваем, чтобы снова были от СТАРЫХ к НОВЫМ
    const sortedMessages = messages.reverse();
    
    // 2. Находим индекс первого сообщения от 'user'
    let firstUserIndex = -1;
    for (let i = 0; i < sortedMessages.length; i++) {
        if (sortedMessages[i].role === ChatMessageRole.USER) {
            firstUserIndex = i;
            break;
        }
    }

    if (firstUserIndex === -1) {
        // Если в последних 20 сообщениях нет ни одного от юзера, возвращаем пустую историю
        return [];
    }

    // 3. Обрезаем историю, чтобы она начиналась с сообщения пользователя
    const validHistory = sortedMessages.slice(firstUserIndex);

    // 4. Форматируем в нужный вид
    return validHistory.map((msg) => ({
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

  /**
   * Получает историю чата для отображения пользователю.
   * @param userId - ID пользователя.
   */
  async getHistoryForUser(userId: number) {
    const messages = await this.chatMessageRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'ASC' },
      // Можно отдать больше сообщений для истории
      take: 50, 
    });

    // Просто возвращаем массив сообщений
    return messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
    }));
  }
}
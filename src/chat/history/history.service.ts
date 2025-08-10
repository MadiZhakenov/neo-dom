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
  ) {}

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

    return messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
    }));
  }
}
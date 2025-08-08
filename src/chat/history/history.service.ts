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
   * Обеспечивает правильное чередование ролей, чтобы история всегда начиналась с 'user'.
   * @param userId - ID пользователя.
   * @returns Массив сообщений в формате для AI.
   */
async getHistory(userId: number): Promise<Content[]> {
  const messages = await this.chatMessageRepository.find({
    where: { user: { id: userId } },
    order: { createdAt: 'DESC' },
    take: 20, // Берем с запасом
  });

  if (messages.length === 0) {
    return [];
  }
  
  const sortedMessages = messages.reverse();
  
  const firstUserIndex = sortedMessages.findIndex(msg => msg.role === ChatMessageRole.USER);

  if (firstUserIndex === -1) {
    return [];
  }

  const validHistory = sortedMessages.slice(firstUserIndex);

  return validHistory.map((msg) => ({
    role: msg.role as 'user' | 'model',
    parts: [{ text: msg.content }],
  }));
}
  
  // --- НОВЫЕ И ИЗМЕНЕННЫЕ МЕТОДЫ ---

  /**
   * Сохраняет ТОЛЬКО сообщение пользователя в историю.
   * @param userId - ID пользователя.
   * @param userContent - Текст сообщения.
   */
  async addUserMessageToHistory(userId: number, userContent: string): Promise<void> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      console.error(`addUserMessageToHistory: Пользователь с ID ${userId} не найден.`);
      return;
    }

    const userMessage = this.chatMessageRepository.create({
      user,
      role: ChatMessageRole.USER,
      content: userContent,
    });
    await this.chatMessageRepository.save(userMessage);
  }

  /**
   * Сохраняет ТОЛЬКО ответ модели в историю.
   * @param userId - ID пользователя.
   * @param modelContent - Текст ответа AI.
   */
  async addModelMessageToHistory(userId: number, modelContent: string): Promise<void> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      console.error(`addModelMessageToHistory: Пользователь с ID ${userId} не найден.`);
      return;
    }
    
    const modelMessage = this.chatMessageRepository.create({
      user,
      role: ChatMessageRole.MODEL,
      content: modelContent,
    });
    await this.chatMessageRepository.save(modelMessage);
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
    user,
    role: ChatMessageRole.USER,
    content: userContent,
  });

  const modelMessage = this.chatMessageRepository.create({
    user,
    role: ChatMessageRole.MODEL,
    content: modelContent,
  });

  await this.chatMessageRepository.save([userMessage, modelMessage]);
}

/**
   * Получает историю чата для отображения пользователю на фронтенде.
   * @param userId - ID пользователя.
   */
async getHistoryForUser(userId: number) {
  const messages = await this.chatMessageRepository.find({
    where: { user: { id: userId } },
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
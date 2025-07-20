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

  async getHistory(userId: number): Promise<{ role: string; parts: { text: string }[] }[]> {
    const messages = await this.chatMessageRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'ASC' },
      take: 10,
    });
  
    if (messages.length > 0 && messages[0].role === ChatMessageRole.MODEL) {
      console.warn(`[History Service] Обнаружена некорректная история: первое сообщение от модели (userId: ${userId}). История будет проигнорирована.`);
      return [];
    }
  
    return messages.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));
  }
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

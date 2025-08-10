/**
 * @file src/chat/entities/chat-message.entity.ts
 * @description Сущность TypeORM для хранения сообщений чата.
 */

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Роль отправителя сообщения.
 */
export enum ChatMessageRole {
  USER = 'user',
  MODEL = 'model',
}

export enum ChatType {
  GENERAL = 'chat',
  DOCUMENT = 'document',
}

@Entity('chat_message') 
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id: number;

  // Связь "многие-к-одному" с пользователем
  @ManyToOne(() => User, (user) => user.id, { eager: false })
  user: User;

  @Column({ type: 'enum', enum: ChatMessageRole })
  role: ChatMessageRole;

  @Column({ type: 'text' })
  content: string;

  // Автоматически устанавливаемая дата создания
  @CreateDateColumn()
  createdAt: Date;

  @Column({
    type: 'enum',
    enum: ChatType,
    default: ChatType.GENERAL, // По умолчанию - обычный чат
  })
  type: ChatType;
}
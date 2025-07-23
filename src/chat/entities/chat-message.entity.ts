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

@Entity()
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
}
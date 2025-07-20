// src/chat/entities/chat-message.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ChatMessageRole {
  USER = 'user',
  MODEL = 'model',
}

@Entity()
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.id, { eager: false })
  user: User;

  @Column({
    type: 'enum',
    enum: ChatMessageRole,
  })
  role: ChatMessageRole;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn()
  createdAt: Date;
}
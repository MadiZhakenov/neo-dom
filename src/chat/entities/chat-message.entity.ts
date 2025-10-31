import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { User } from '../../users/entities/user.entity';

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

  @ManyToOne(() => User, (user) => user.id, { eager: false })
  user: User;

  @Column({ type: 'enum', enum: ChatMessageRole })
  role: ChatMessageRole;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({
    type: 'enum',
    enum: ChatType,
    default: ChatType.GENERAL,
  })
  type: ChatType;
}
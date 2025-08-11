import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ChatMessage } from '../../chat/entities/chat-message.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password_hash: string;

  @Column({ default: 'Базовый' })
  tariff: string;

  @Column({ type: 'timestamp', nullable: true, default: null })
  last_generation_date: Date | null;

  @Column({ nullable: true, default: null })
  full_name: string;

  @Column({ nullable: true, default: null })
  phone: string;

  @Column({ default: 'resident' })
  role: 'resident' | 'admin' | 'accountant';
  
  @Column({ type: 'timestamp', nullable: true, default: null })
  subscription_expires_at: Date | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  password_reset_token: string | null;
 
  @Column({ type: 'timestamp', nullable: true, default: null })
  password_reset_expires: Date | null;

  @Column({ type: 'boolean', default: false })
  password_change_required: boolean;

  // Добавляем связь с сообщениями чата
  @OneToMany(() => ChatMessage, (message) => message.user)
  chatMessages: ChatMessage[];
}
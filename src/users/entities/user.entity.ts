/**
 * @file src/users/entities/user.entity.ts
 * @description Сущность TypeORM, описывающая таблицу 'users' в базе данных.
 */

import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * Перечисление возможных состояний чата для пользователя.
 */
export enum UserChatState {
  /** Обычный режим чата. */
  IDLE = 'idle',
  /** Режим сбора данных для генерации документа. */
  WAITING_FOR_DATA = 'waiting_for_data',
}

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

  @Column({ type: 'int', default: 0 })
  generation_count: number; // Устарело, но оставлено для совместимости

  @Column({ type: 'timestamp', nullable: true, default: null })
  last_generation_date: Date | null;

  @Column({ nullable: true })
  full_name: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: 'resident' })
  role: 'resident' | 'admin' | 'accountant';

  @Column({ type: 'enum', enum: UserChatState, default: UserChatState.IDLE })
  chat_state: UserChatState;

  @Column({ type: 'varchar', nullable: true })
  pending_template_name: string | null;

  @Column({ type: 'varchar', nullable: true })
  pending_request_id: string | null;

  /*Дата и время, когда истекает активная премиум-подписка. 
    Если null, значит, у пользователя базовый тариф.
   */
  
  @Column({ type: 'timestamp', nullable: true, default: null })
  subscription_expires_at: Date | null;

   /**
   * Токен для сброса/установки пароля.
   */
   @Column({ type: 'varchar', nullable: true, default: null })
   password_reset_token: string | null;
 
   /**
    * Время, до которого действителен токен сброса пароля.
    */
   @Column({ type: 'timestamp', nullable: true, default: null })
   password_reset_expires: Date | null;
}
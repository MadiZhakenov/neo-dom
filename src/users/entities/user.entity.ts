// src/users/entities/user.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum UserChatState {
  IDLE = 'idle',
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
  generation_count: number;

  @Column({ type: 'timestamp', nullable: true, default: null })
  last_generation_date: Date | null;

  @Column({ nullable: true })
  full_name: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: 'resident' })
  role: 'resident' | 'admin' | 'accountant';

  @Column({
    type: 'enum',
    enum: UserChatState,
    default: UserChatState.IDLE,
  })
  chat_state: UserChatState;

  @Column({ type: 'varchar', nullable: true })
  pending_template_name: string | null;

  @Column({ type: 'varchar', nullable: true })
  pending_request_id: string | null;
}

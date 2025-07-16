// src/users/entities/user.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
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
}
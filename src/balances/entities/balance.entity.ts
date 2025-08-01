// src\balances\entities\balance.entity.ts

import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Apartment } from '../../apartments/entities/apartment.entity';

@Entity('balances')
export class Balance {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Apartment)
  apartment: Apartment;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}

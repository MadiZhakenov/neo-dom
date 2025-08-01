// src\data-import\entities\balance.entity.ts

import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Apartment } from './apartment.entity';

@Entity('balances')
export class Balance {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Apartment, (apt) => apt.balances, { onDelete: 'CASCADE', eager: true })
  @JoinColumn()
  apartment: Apartment;

  @Column('date')
  as_of_date: string;

  @Column('numeric', { precision: 14, scale: 2, default: 0 })
  amount: string;
}

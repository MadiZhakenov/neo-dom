import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Apartment } from './apartment.entity';

@Entity()
export class Balance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @ManyToOne(() => Apartment, (apartment) => apartment.balances, {
    onDelete: 'CASCADE',
  })
  apartment: Apartment;
}

import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Balance } from './balance.entity';

@Entity('apartments')
export class Apartment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  number: string;

  @Column({ nullable: true })
  address?: string;

  @OneToMany(() => Balance, (b) => b.apartment)
  balances: Balance[];
}

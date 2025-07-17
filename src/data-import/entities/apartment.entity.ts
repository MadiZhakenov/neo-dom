import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Balance } from './balance.entity';

@Entity()
export class Apartment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  number: string;

  @Column()
  ownerName: string;

  @OneToMany(() => Balance, (balance) => balance.apartment)
  balances: Balance[];
}
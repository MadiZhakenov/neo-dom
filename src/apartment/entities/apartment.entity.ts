import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('apartments')
export class Apartment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  number: string;

  @Column()
  address: string;

  @ManyToOne(() => User, { nullable: true })
  resident: User;
}

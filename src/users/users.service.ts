// src/users/users.service.ts

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserChatState } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: any): Promise<Omit<User, 'password_hash'>> {
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(createUserDto.password, salt);

    const newUser = this.usersRepository.create({
      email: createUserDto.email,
      password_hash: hashedPassword,
    });

    const savedUser = await this.usersRepository.save(newUser);

    const { password_hash, ...result } = savedUser;
    return result;
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async incrementGenerationCount(userId: number): Promise<void> {
    await this.usersRepository.update(userId, {
      generation_count: () => 'generation_count + 1',
      last_generation_date: new Date(),
    });
  }

  async resetGenerationCount(userId: number): Promise<void> {
    await this.usersRepository.update(userId, {
      generation_count: 0,
    });
  }

  async resetGenerationsByEmail(email: string): Promise<User | null> {
    const user = await this.findOneByEmail(email);
    if (!user) {
      return null;
    }
    user.generation_count = 0;
    user.last_generation_date = null;
    return this.usersRepository.save(user);
  }

  async findOneById(id: number): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  async setChatState(
    userId: number, 
    state: UserChatState, 
    templateName: string | null = null,
    requestId: string | null = null
  ): Promise<void> {
    await this.usersRepository.update(userId, {
      chat_state: state,
      pending_template_name: templateName,
      pending_request_id: requestId,
    });
  }

}

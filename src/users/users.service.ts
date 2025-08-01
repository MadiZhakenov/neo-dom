/**
 * @file src/users/users.service.ts
 * @description Сервис для управления данными пользователей в базе данных.
 * Инкапсулирует всю логику работы с сущностью User.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserChatState } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * Создает нового пользователя, хэширует пароль и сохраняет в базу данных.
   * @param createUserDto - DTO с email и паролем нового пользователя.
   * @returns Созданный объект пользователя без хэша пароля.
   */
  async create(createUserDto: CreateUserDto): Promise<Omit<User, 'password_hash'>> {
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

  /**
   * Находит пользователя в базе данных по его email.
   * @param email - Email пользователя для поиска.
   * @returns Объект пользователя или null, если пользователь не найден.
   */
  async findOneByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  /**
   * Увеличивает счетчик генераций на 1 и обновляет дату последней генерации.
   * Этот метод устарел и был заменен на setLastGenerationDate для новой логики лимитов.
   * @param userId - ID пользователя.
   * @deprecated
   */
  async incrementGenerationCount(userId: number): Promise<void> {
    await this.usersRepository.update(userId, {
      generation_count: () => 'generation_count + 1',
      last_generation_date: new Date(),
    });
  }

  /**
   * Сбрасывает счетчик генераций пользователя.
   * @param userId - ID пользователя.
   * @deprecated
   */
  async resetGenerationCount(userId: number): Promise<void> {
    await this.usersRepository.update(userId, {
      generation_count: 0,
    });
  }

  /**
   * Сбрасывает лимиты генерации для пользователя по email (для отладки).
   * @param email - Email пользователя.
   * @returns Обновленный объект пользователя или null.
   */
  async resetGenerationsByEmail(email: string): Promise<User | null> {
    const user = await this.findOneByEmail(email);
    if (!user) {
      return null;
    }
    user.generation_count = 0;
    user.last_generation_date = null;
    return this.usersRepository.save(user);
  }

  /**
   * Находит пользователя в базе данных по его ID.
   * @param id - ID пользователя.
   * @returns Объект пользователя или null.
   */
  async findOneById(id: number): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  /**
   * Устанавливает и сохраняет текущее состояние чата для пользователя.
   * @param userId - ID пользователя.
   * @param state - Новое состояние (IDLE или WAITING_FOR_DATA).
   * @param templateName - Имя шаблона, который заполняется (если есть).
   * @param requestId - Уникальный ID текущего запроса на генерацию (если есть).
   */
  async setChatState(
    userId: number,
    state: UserChatState,
    templateName: string | null = null,
    requestId: string | null = null,
  ): Promise<void> {
    await this.usersRepository.update(userId, {
      chat_state: state,
      pending_template_name: templateName,
      pending_request_id: requestId,
    });
  }

  /**
   * Устанавливает дату последней успешной генерации документа.
   * Используется для новой логики лимитов (1 генерация в месяц).
   * @param userId - ID пользователя.
   * @param date - Текущая дата.
   */
  async setLastGenerationDate(userId: number, date: Date): Promise<void> {
    await this.usersRepository.update(userId, {
      last_generation_date: date,
    });
  }

  /**
   * Активирует премиум-статус для пользователя.
   * @param userId - ID пользователя.
   * @param expirationDate - Дата, до которой действует подписка.
   */
  async activatePremium(userId: number, expirationDate: Date): Promise<void> {
    await this.usersRepository.update(userId, {
      tariff: 'Премиум',
      subscription_expires_at: expirationDate,
    });
  }

  /**
   * Деактивирует премиум-статус (возвращает к базовому).
   * @param userId - ID пользователя.
   */
  async deactivatePremium(userId: number): Promise<void> {
    await this.usersRepository.update(userId, {
      tariff: 'Базовый',
      subscription_expires_at: null,
    });
  }
  /**
   * Устанавливает токен и время его жизни для сброса пароля.
   */
  async setPasswordResetToken(userId: number, token: string, expires: Date): Promise<void> {
    await this.usersRepository.update(userId, {
      password_reset_token: token,
      password_reset_expires: expires,
    });
  }

  /**
   * Находит пользователя по токену сброса пароля.
   */
  async findOneByPasswordResetToken(token: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: {
        password_reset_token: token,
      },
    });
  }

  /**
   * Обновляет хэш пароля пользователя и очищает токены сброса.
   */
  async updatePassword(userId: number, password_hash: string): Promise<void> {
    await this.usersRepository.update(userId, {
      password_hash: password_hash,
      password_reset_token: null,
      password_reset_expires: null,
    });
  }
}
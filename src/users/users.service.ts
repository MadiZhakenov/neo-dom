/**
 * @file src/users/users.service.ts
 * @description Сервис для управления данными пользователей в базе данных.
 * Инкапсулирует всю логику работы с сущностью User.
 */

import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { User } from './entities/user.entity';
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

  /**
   * Позволяет авторизованному пользователю сменить свой пароль.
   * @param userId - ID пользователя из JWT токена.
   * @param oldPass - Текущий пароль для проверки.
   * @param newPass - Новый пароль.
   */
  async changePassword(userId: number, oldPass: string, newPass: string): Promise<{ message: string }> {
    const user = await this.usersRepository.findOneBy({ id: userId });

    // --- ИСПРАВЛЕНИЕ 1: ДОБАВЛЯЕМ ПРОВЕРКУ ---
    if (!user) {
      // Этого не должно случиться, если токен валидный, но проверка нужна
      throw new UnauthorizedException('Пользователь не найден.');
    }
    
    // Теперь TypeScript знает, что после этой проверки 'user' не может быть null
    const isMatch = await bcrypt.compare(oldPass, user.password_hash);
    // 2. Хэшируем и сохраняем новый пароль
    const salt = await bcrypt.genSalt();
    const newHash = await bcrypt.hash(newPass, salt);

    await this.usersRepository.update(userId, {
      password_hash: newHash,
      // Сбрасываем флаг принудительной смены, если он был
      password_change_required: false,
    });
    
    return { message: 'Пароль успешно изменен.' };
  }

  /**
   * Находит всех пользователей с истекшей премиум-подпиской и меняет их тариф на "Базовый".
   * Вызывается фоновой задачей (Cron Job).
   * @returns Количество деактивированных пользователей.
   */
  async deactivateExpiredPremiums(): Promise<number> {
    const now = new Date();
    
    // 1. Находим всех пользователей, у которых:
    //    - Тариф "Премиум"
    //    - И дата истечения подписки УЖЕ ПРОШЛА (меньше, чем текущая)
    const expiredUsers = await this.usersRepository.find({
      where: {
        tariff: 'Премиум',
        subscription_expires_at: LessThan(now),
      },
    });

    if (expiredUsers.length === 0) {
      return 0; // Если таких нет, выходим
    }

    // 2. Получаем ID всех найденных пользователей
    const userIds = expiredUsers.map(user => user.id);

    // 3. Одним запросом обновляем всем им тариф и сбрасываем дату
    await this.usersRepository.update(userIds, {
      tariff: 'Базовый',
      subscription_expires_at: null,
    });

    return userIds.length;
  }

  /**
   * Получает и форматирует данные профиля для фронтенда.
   * Включает актуальный статус подписки.
   * @param userId - ID пользователя.
   */
  async getUserProfile(userId: number) {
    const user = await this.findOneById(userId);

    if (!user) {
      throw new NotFoundException('Пользователь не найден.');
    }
    
    // Определяем, активна ли подписка
    const isPremiumActive = user.tariff === 'Премиум' && user.subscription_expires_at && user.subscription_expires_at > new Date();

    return {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      phone: user.phone,
      role: user.role,
      subscription: {
        isActive: isPremiumActive,
        // Если подписка активна, отдаем дату истечения, иначе null
        expiresAt: isPremiumActive ? user.subscription_expires_at : null,
      },
    };
  }
}
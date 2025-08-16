/**
 * @file src/auth/auth.service.ts
 * @description Сервис, реализующий логику аутентификации пользователей.
 */

import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';
import * as crypto from 'crypto';

import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private mailService: MailService,
    private configService: ConfigService, // <-- ДОБАВЛЯЕМ ЭТО
  ) {}

  /**
   * Проверяет учетные данные пользователя.
   * Находит пользователя по email и сравнивает хэш пароля.
   * @param email - Email пользователя.
   * @param pass - Пароль пользователя.
   * @returns Объект пользователя без хэша пароля или null.
   */
  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOneByEmail(email);
    if (user && (await bcrypt.compare(pass, user.password_hash))) {
      const { password_hash, ...result } = user;
      return result;
    }
    return null;
  }

  /**
   * Генерирует и возвращает JWT токен для аутентифицированного пользователя.
   * @param user - Объект пользователя, прошедшего валидацию.
   * @returns Объект с access_token.
   */
  async login(user: any) {
    const payload = { email: user.email, sub: user.id, tariff: user.tariff };
    
    // Создаем оба токена
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION', '1h') // Access token живет 1 час
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'), // Используем другой секрет!
        expiresIn: '7d', // Refresh token живет 7 дней
      }),
    ]);

    // Хэшируем и сохраняем refresh token в базу
    await this.usersService.setCurrentRefreshToken(refreshToken, user.id);

    return {
      accessToken,
      refreshToken,
    };
  }

  // --- ДОБАВЛЯЕМ НОВЫЙ МЕТОД REFRESH ---
  async refreshTokens(userId: number, refreshToken: string) {
    const user = await this.usersService.findOneById(userId);
    if (!user || !user.currentHashedRefreshToken) {
      throw new ForbiddenException('Access Denied');
    }

    // Проверяем, совпадает ли присланный токен с тем, что в базе
    const refreshTokenMatches = await bcrypt.compare(
      refreshToken,
      user.currentHashedRefreshToken,
    );

    if (!refreshTokenMatches) {
      throw new ForbiddenException('Access Denied');
    }

    // Все в порядке, выдаем новую пару токенов
    const newTokens = await this.login(user); // Переиспользуем логику login
    return newTokens;
  }

  // --- ДОБАВЛЯЕМ НОВЫЙ МЕТОД LOGOUT ---
  async logout(userId: number) {
    return this.usersService.setCurrentRefreshToken(null, userId);
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      console.warn(`Запрос на сброс пароля для несуществующего email: ${email}`);
      return { message: 'Если такой пользователь существует, ему будет отправлена ссылка для сброса пароля.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 час

    await this.usersService.setPasswordResetToken(user.id, token, expires);

    // --- ЗАМЕНЯЕМ CONSOLE.LOG НА РЕАЛЬНУЮ ОТПРАВКУ ---
    await this.mailService.sendPasswordResetEmail(user.email, token);

    return { message: 'Если такой пользователь существует, ему будет отправлена ссылка для сброса пароля.' };
  }
  /**
   * Устанавливает новый пароль для пользователя, используя токен.
   * @param token - Токен из ссылки.
   * @param newPassword - Новый пароль.
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.usersService.findOneByPasswordResetToken(token);

    if (!user) {
      throw new UnauthorizedException('Токен для сброса пароля недействителен или истек.');
    }

    // Хэшируем и сохраняем новый пароль
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    await this.usersService.updatePassword(user.id, hashedPassword);

    return { message: 'Пароль успешно обновлен.' };
  }

  /**
   * Генерирует новый JWT токен для пользователя по его ID.
   * Используется для обновления токена после важных изменений (например, смены тарифа).
   * @param userId - ID пользователя.
   * @returns Объект с новым access_token.
   */
  async refreshTokenForUser(userId: number) {
    // Получаем самые свежие данные пользователя из базы
    const user = await this.usersService.findOneById(userId);
    if (!user) {
      // Этого не должно произойти, но на всякий случай
      throw new UnauthorizedException('Пользователь не найден для обновления токена.');
    }

    const payload = { email: user.email, sub: user.id, tariff: user.tariff };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}

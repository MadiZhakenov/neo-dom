/**
 * @file src/auth/auth.service.ts
 * @description Сервис, реализующий логику аутентификации пользователей.
 */

import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
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
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}

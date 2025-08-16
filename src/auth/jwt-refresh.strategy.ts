import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(configService: ConfigService) {
    // 1. Сначала получаем секрет в переменную
    const secret = configService.get<string>('JWT_REFRESH_SECRET');

    // 2. Добавляем "защиту от дурака": если секрета нет, приложение не запустится
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET не найден в .env файле! Приложение не может быть запущено.');
    }

    // 3. Передаем в super() уже гарантированно существующий secret
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret, // <-- Передаем переменную, а не вызов
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: any) {
    const refreshToken = req.get('authorization')?.replace('Bearer', '').trim();

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }
    
    return { ...payload, refreshToken };
  }
}
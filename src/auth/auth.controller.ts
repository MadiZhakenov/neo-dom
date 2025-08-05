// src/auth/auth.controller.ts

import { Controller, Post, Body, UnauthorizedException, Get, Res, Query, Render } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Response } from 'express'; 

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Неправильный email или пароль');
    }
    return this.authService.login(user);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto.token, resetPasswordDto.password);
  }

  /**
   * Этот эндпоинт обрабатывает GET-запрос по ссылке из письма.
   * Он не делает ничего, кроме как перенаправляет пользователя на нашу HTML-страницу.
   * @param res - Объект ответа Express.
   */
  @Get('reset-password')
  @Render('reset-password') // <-- Указываем, какой шаблон рендерить (без .hbs)
  showResetPasswordPage(@Query('token') token: string) {
    // Просто передаем токен из URL в шаблон
    return { token };
  }
}

// src/users/users.controller.ts

import { Controller, Post, Body, Get, UseGuards, Request,Param, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; 

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Get('protocols')
  getProtocols(@Request() req) {
    
    console.log(`Пользователь ${req.user.email} запросил протоколы.`);

    return [
      { id: 1, name: 'Протокол собрания №1 от 01.06.2025', url: '/files/protocol1.pdf' },
      { id: 2, name: 'Протокол собрания №2 от 01.07.2025', url: '/files/protocol2.pdf' },
    ];
  }

  @Post('reset-limit/:email')
  async resetLimit(@Param('email') email: string) {
    console.log(`[DEBUG] Получен запрос на сброс лимита для пользователя: ${email}`);
    const updatedUser = await this.usersService.resetGenerationsByEmail(email);

    if (!updatedUser) {
      throw new NotFoundException(`Пользователь с email ${email} не найден.`);
    }

    return {
      message: `Лимит для пользователя ${email} успешно сброшен.`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        generation_count: updatedUser.generation_count,
      },
    };
  }

}

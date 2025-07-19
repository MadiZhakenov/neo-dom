// src/users/users.controller.ts

import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
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
}

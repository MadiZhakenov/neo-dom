/**
 * @file src/users/users.module.ts
 * @description Модуль для управления пользователями.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // Экспортируем сервис для использования в AuthModule и AiModule
})
export class UsersModule {}
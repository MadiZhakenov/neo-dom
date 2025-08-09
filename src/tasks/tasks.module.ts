// src\tasks\tasks.module.ts
import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { UsersModule } from '../users/users.module'; // Нам нужен доступ к UsersService

@Module({
  imports: [UsersModule], // Импортируем UsersModule
  providers: [TasksService],
})
export class TasksModule {}
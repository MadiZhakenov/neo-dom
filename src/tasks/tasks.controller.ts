import { Controller, Get, Post, Body, Param, Patch, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskStatus } from './entities/task.entity';
import { UsersService } from '../users/users.service';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator'; // <-- ДОБАВЛЕНО

class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;
}

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  async getTasks() {
    return this.taskRepo.find({ order: { createdAt: 'DESC' }, relations: ['author'] });
  }

  @Post()
  async createTask(@Request() req, @Body() createTaskDto: CreateTaskDto) {
    const user = await this.usersService.findOneById(req.user.userId);
    // Теперь description будет либо строкой, либо undefined, что нормально
    const newTask = this.taskRepo.create({ 
      ...createTaskDto, 
      description: createTaskDto.description || '', // На случай если description не придет
      author: user, 
      status: TaskStatus.OPEN 
    });
    return this.taskRepo.save(newTask);
  }

  @Patch(':id/close')
  async closeTask(@Param('id') id: string) {
    const taskId = parseInt(id, 10);
    await this.taskRepo.update(taskId, { status: TaskStatus.CLOSED });
    return this.taskRepo.findOneBy({ id: taskId });
  }
}
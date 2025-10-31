// src/documents/documents.controller.ts
import { Controller, Get, Post, Param, Body, Res, UseGuards, Request } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Response } from 'express';
import { UsersService } from '../users/users.service'; // Импортируем для проверки лимитов
import { IsNotEmpty, IsObject } from 'class-validator';

// DTO для валидации входящих данных
class GenerateDto {
  @IsObject()
  @IsNotEmpty()
  data: any;
}

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly usersService: UsersService, // Добавляем сервис пользователей
  ) {}

  @Get('templates')
  @UseGuards(JwtAuthGuard)
  getTemplates() {
    return this.documentsService.getTemplateList();
  }

  @Get('templates/:id')
  @UseGuards(JwtAuthGuard)
  getTemplateFields(@Param('id') id: string) {
    return this.documentsService.getTemplateFields(id);
  }

  @Post('generate/:id')
  @UseGuards(JwtAuthGuard)
  async generateDoc(
    @Request() req,
    @Param('id') id: string,
    @Body() generateDto: GenerateDto,
    @Res() res: Response,
  ) {
    const userId = req.user.userId;

    // Проверяем лимиты перед генерацией
    await this.usersService.checkAndIncrementGeneration(userId);

    const { buffer, fileName } = this.documentsService.generateDocument(id, generateDto.data);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }
}
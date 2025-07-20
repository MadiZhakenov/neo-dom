// src/ai/ai.controller.ts

import { Controller, Post, Body, UseGuards, Request, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AiService } from './ai.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GenerateDocumentDto } from './dto/generate-document.dto';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly usersService: UsersService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('chat')
  async chatWithAssistant(
    @Request() req,
    @Body() generateDto: GenerateDocumentDto,
  ) {
    const userId = req.user.userId;
    const user = await this.usersService.findOneById(userId);

    if (!user) {
      throw new NotFoundException('Пользователь не найден.');
    }

    if (user.tariff === 'Базовый') {
      const now = new Date();
      const lastGen = user.last_generation_date;

      if (!lastGen || lastGen.getMonth() !== now.getMonth() || lastGen.getFullYear() !== now.getFullYear()) {
        await this.usersService.resetGenerationCount(user.id);
        user.generation_count = 0;
      }

      if (user.generation_count >= 100) { 
        throw new ForbiddenException('Превышен лимит сообщений для Базового тарифа.');
      }
    }

    const response = await this.aiService.getAiResponse(generateDto.prompt, userId);
    await this.usersService.incrementGenerationCount(user.id);

    return {
      aiResponse: response,
    };
  }
}

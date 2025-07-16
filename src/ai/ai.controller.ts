// src/ai/ai.controller.ts

import { Controller, Post, Body, UseGuards, Request, ForbiddenException, NotFoundException, Res } from '@nestjs/common';
import { Response } from 'express';
import { AiService } from './ai.service';
import { PdfService } from './pdf/pdf.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GenerateDocumentDto } from './dto/generate-document.dto';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly usersService: UsersService,
    private readonly pdfService: PdfService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('generate-document')
  async generateDocument(@Request() req, @Body() generateDto: GenerateDocumentDto, @Res() res: Response) {
    const userPayload = req.user;
    const user = await this.usersService.findOneByEmail(userPayload.email);

    if (!user) {
      throw new NotFoundException('Пользователь с таким токеном не найден в базе данных.');
    }

    if (user.tariff === 'Базовый') {
      const now = new Date();
      const lastGen = user.last_generation_date;

      if (lastGen && (lastGen.getMonth() !== now.getMonth() || lastGen.getFullYear() !== now.getFullYear())) {
        await this.usersService.resetGenerationCount(user.id);
        user.generation_count = 0;
      }

      if (user.generation_count >= 1) {
        throw new ForbiddenException('Превышен лимит генераций для Базового тарифа (1 в месяц).');
      }
    }

    const prompt = generateDto.prompt;
    const generatedText = await this.aiService.generateText(prompt);

    await this.usersService.incrementGenerationCount(user.id);

    const { password_hash, ...userResult } = user;
    userResult.generation_count += 1;

    const pdfBuffer = await this.pdfService.createPdfFromText(generatedText);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=generated-document.pdf');
    
    res.send(pdfBuffer);
  }
}

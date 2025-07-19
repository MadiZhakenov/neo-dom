// src/ai/ai.controller.ts

import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  ForbiddenException,
  NotFoundException,
  Res,
} from '@nestjs/common';
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
  @Post('assistant')
  async generateDocument(
    @Request() req,
    @Body() generateDto: GenerateDocumentDto,
    @Res() res: Response,
  ) {
    const user = await this.usersService.findOneByEmail(req.user.email);
    if (!user) {
      throw new NotFoundException('Пользователь не найден.');
    }

    if (user.tariff === 'Базовый') {
      const now = new Date();
      const lastGen = user.last_generation_date;
      const isNewMonth =
        !lastGen ||
        lastGen.getMonth() !== now.getMonth() ||
        lastGen.getFullYear() !== now.getFullYear();

      if (isNewMonth) {
        await this.usersService.resetGenerationCount(user.id);
        user.generation_count = 0;
      }

      if (user.generation_count >= 1) {
        throw new ForbiddenException(
          'Превышен лимит генераций для Базового тарифа (1 в месяц).',
        );
      }
    }

    const { intent, text } = await this.aiService.generateText(generateDto.prompt);
    await this.usersService.incrementGenerationCount(user.id);

    if (intent === 'generate_document') {
      console.log(`[AI Controller] Намерение: ${intent}. Генерирую файл PDF.`);

      const pdfBuffer = await this.pdfService.createPdfFromText(text);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=generated-document.pdf');
      res.send(pdfBuffer);

    } else {
      console.log(`[AI Controller] Намерение: ${intent}. Возвращаю текстовый ответ.`);

      res.status(200).json({
        aiResponse: text,
      });
    }
  }
}

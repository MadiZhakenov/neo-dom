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
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GenerateDocumentDto } from './dto/generate-document.dto';
import { GenerateFinalDocDto } from './dto/generate-final-doc.dto';
import { DocxService } from '../documents/docx/docx.service';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly usersService: UsersService,
    private readonly docxService: DocxService,
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

    const response = await this.aiService.getChatResponse(generateDto.prompt, userId);
    await this.usersService.incrementGenerationCount(user.id);

    if (response.type === 'start_generation') {
      const templateName = response.content;
      const fieldsToFill = await this.aiService.getFieldsForTemplate(templateName);
      return {
        action: 'collect_data',
        templateName: templateName,
        fields: fieldsToFill,
      };
    } else {
      return {
        aiResponse: response.content,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('generate-doc')
  async generateFinalDocument(
    @Body() generateDocDto: GenerateFinalDocDto,
    @Res() res: Response,
  ) {
    try {
      const extractedData = await this.aiService.extractDataForDocx(
        generateDocDto.userAnswersPrompt,
        generateDocDto.templateName
      );

      const docxBuffer = this.docxService.generateDocx(generateDocDto.templateName, extractedData);

      const encodedFileName = encodeURIComponent(generateDocDto.templateName);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedFileName}`);
      res.send(docxBuffer);
    } catch (error) {
      res.status(500).json({ message: `Не удалось сгенерировать документ: ${error.message}` });
    }
  }
}

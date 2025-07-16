// src/ai/ai.module.ts

import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { UsersModule } from '../users/users.module';
import { PdfService } from './pdf/pdf.service';

@Module({
  imports: [UsersModule],
  providers: [AiService, PdfService],
  exports: [AiService],
  controllers: [AiController],
})
export class AiModule {}
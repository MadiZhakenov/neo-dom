// src/ai/ai.module.ts

import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { UsersModule } from '../users/users.module';
import { PdfService } from './pdf/pdf.service';
import { DocumentsModule } from '../documents/documents.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [UsersModule, DocumentsModule, ChatModule],
  providers: [AiService, PdfService],
  exports: [AiService],
  controllers: [AiController],
})
export class AiModule {}
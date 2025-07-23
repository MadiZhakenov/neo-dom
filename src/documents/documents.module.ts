/**
 * @file src/documents/documents.module.ts
 * @description Модуль для работы с документами (генерация DOCX).
 */

import { Module } from '@nestjs/common';
import { DocxService } from './docx/docx.service';

@Module({
  providers: [DocxService],
  exports: [DocxService], // Экспортируем DocxService для AiModule
})
export class DocumentsModule {}
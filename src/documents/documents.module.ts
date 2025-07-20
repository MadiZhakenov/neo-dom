// src/documents/documents.module.ts
import { Module } from '@nestjs/common';
import { DocxService } from './docx/docx.service';

@Module({
  providers: [DocxService],
  exports: [DocxService],
})
export class DocumentsModule {}
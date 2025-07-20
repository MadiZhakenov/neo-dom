// src/documents/documents.module.ts
import { Module } from '@nestjs/common';
import { DocxService } from './docx/docx.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [DocxService],
  exports: [DocxService],
})
export class DocumentsModule {}
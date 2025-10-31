// src/documents/documents.module.ts
import { Module } from '@nestjs/common';
import { DocxService } from './docx/docx.service';
import { DocumentsController } from './documents.controller'; // <-- ДОБАВЛЯЕМ
import { DocumentsService } from './documents.service';    // <-- ДОБАВЛЯЕМ
import { UsersModule } from '../users/users.module';        // <-- ДОБАВЛЯЕМ (для проверки лимитов)
import { TEMPLATES_REGISTRY } from '../ai/templates.registry';
@Module({
  imports: [UsersModule], // <-- ДОБАВЛЯЕМ
  controllers: [DocumentsController], // <-- ДОБАВЛЯЕМ
  providers: [DocxService, DocumentsService, { // <-- 2. ДОБАВЛЯЕМ ЭТОТ БЛОК
    provide: 'TEMPLATES_REGISTRY',
    useValue: TEMPLATES_REGISTRY,
  },], // <-- ДОБАВЛЯЕМ DocumentsService
  exports: [DocxService],
})
export class DocumentsModule {}
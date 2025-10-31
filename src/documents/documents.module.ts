import { Module } from '@nestjs/common';
import { DocxService } from './docx/docx.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { UsersModule } from '../users/users.module';
import { TEMPLATES_REGISTRY } from '../ai/templates.registry';
@Module({
  imports: [UsersModule],
  controllers: [DocumentsController],
  providers: [DocxService, DocumentsService, {
    provide: 'TEMPLATES_REGISTRY',
    useValue: TEMPLATES_REGISTRY,
  },],
  exports: [DocxService],
})
export class DocumentsModule {}
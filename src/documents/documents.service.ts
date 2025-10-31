// src/documents/documents.service.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DocxService } from './docx/docx.service';

@Injectable()
export class DocumentsService {
  constructor(
    @Inject('TEMPLATES_REGISTRY') private readonly templates: any,
    private readonly docxService: DocxService,
  ) {}

  getTemplateList() {
    return Object.keys(this.templates).map(id => ({
      id,
      name: this.templates[id].name,
      language: this.templates[id].language,
    }));
  }

  getTemplateFields(id: string) {
    const template = this.templates[id];
    if (!template) {
      throw new NotFoundException(`Шаблон с ID "${id}" не найден`);
    }
    return template.fields;
  }

  generateDocument(id: string, data: any) {
    const template = this.templates[id];
    if (!template) {
      throw new NotFoundException(`Шаблон с ID "${id}" не найден`);
    }

    const buffer = this.docxService.generateDocx(id, data);
    return { buffer, fileName: id };
  }
}
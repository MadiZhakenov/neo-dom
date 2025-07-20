// src/documents/docx.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as PizZip from 'pizzip';
import * as Docxtemplater from 'docxtemplater';
import * as fs from 'fs';
import * as path from 'path';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class DocxService {
  constructor(private readonly httpService: HttpService) {}

  generateDocx(templateName: string, data: any): Buffer {
    try {
      const templatePath = path.join(
        process.cwd(),
        'knowledge_base',
        'templates',
        'docx',
        templateName,
      );
      const content = fs.readFileSync(templatePath, 'binary');
      const zip = new PizZip(content);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });
      doc.render(data);
      const buf = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });
      return buf;
    } catch (error) {
      console.error('Ошибка при генерации DOCX:', error);
      throw new Error(`Не удалось сгенерировать документ из шаблона ${templateName}`);
    }
  }

  async convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
    try {
      console.log('[DocxService] Отправка DOCX на конвертацию в PDF...');
      const response$ = this.httpService.post(
        'http://localhost:3001/lool/convert-to/pdf',
        docxBuffer,
        {
          headers: {
            'Content-Type':
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          },
          responseType: 'arraybuffer',
        },
      );

      const response = await lastValueFrom(response$);
      console.log('[DocxService] PDF успешно сконвертирован.');
      return response.data;
    } catch (error) {
      console.error('Ошибка при конвертации в PDF:', error?.response?.data?.toString() || error.message);
      throw new Error('Не удалось сконвертировать документ в PDF.');
    }
  }
}

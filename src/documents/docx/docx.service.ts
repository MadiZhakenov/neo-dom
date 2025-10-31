import { Injectable } from '@nestjs/common';
import * as PizZip from 'pizzip';
import * as Docxtemplater from 'docxtemplater';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DocxService {
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
        nullGetter: () => "",
      });

      doc.render(data);

      const buf = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });

      return buf;
    } catch (error) {
      console.error(`Ошибка при генерации DOCX для шаблона ${templateName}:`, error);
      throw new Error(`Не удалось сгенерировать документ из шаблона ${templateName}. Ошибка: ${error.message}`);
    }
  }
}
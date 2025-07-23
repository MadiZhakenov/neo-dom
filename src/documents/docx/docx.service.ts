/**
 * @file src/documents/docx/docx.service.ts
 * @description Сервис для генерации документов в формате .docx на основе шаблонов.
 */

import { Injectable } from '@nestjs/common';
import * as PizZip from 'pizzip';
import * as Docxtemplater from 'docxtemplater';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DocxService {
  /**
   * Генерирует .docx файл из шаблона и данных.
   * @param templateName - Имя файла шаблона (например, 'my-template.docx').
   * @param data - Объект с данными, где ключи соответствуют тегам в шаблоне.
   * @returns Буфер с данными сгенерированного .docx файла.
   */
  generateDocx(templateName: string, data: any): Buffer {
    try {
      const templatePath = path.join(
        process.cwd(),
        'knowledge_base',
        'templates',
        'docx',
        templateName,
      );

      // Читаем шаблон как бинарный файл
      const content = fs.readFileSync(templatePath, 'binary');

      const zip = new PizZip(content);

      const doc = new Docxtemplater(zip, {
        paragraphLoop: true, // Включаем поддержку циклов для таблиц и списков
        linebreaks: true, // Включаем поддержку переносов строк \n
        // Эта функция будет вызвана для любого тега, значение которого равно null или undefined.
        // Она заменяет его на пустую строку, чтобы избежать появления "undefined" в документе.
        nullGetter: () => "",
      });

      // Заполняем шаблон данными
      doc.render(data);

      // Генерируем буфер итогового файла
      const buf = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });

      return buf;
    } catch (error) {
      // Ловим ошибки, которые могут возникнуть, если в данных не хватает тега или шаблон поврежден
      console.error(`Ошибка при генерации DOCX для шаблона ${templateName}:`, error);
      throw new Error(`Не удалось сгенерировать документ из шаблона ${templateName}. Ошибка: ${error.message}`);
    }
  }
}
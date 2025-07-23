/**
 * @file src/ai/pdf/pdf.service.ts
 * @description Сервис для генерации PDF документов из текста.
 * Не используется в основном флоу генерации, но может быть полезен для других задач.
 */

import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as path from 'path';

@Injectable()
export class PdfService {
  /**
   * Создает PDF документ из переданной строки текста.
   * @param text - Текст для размещения в PDF.
   * @returns Буфер с данными сгенерированного PDF файла.
   */
  async createPdfFromText(text: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 72, right: 72 },
      });

      // Регистрация шрифта, поддерживающего кириллицу
      const fontPath = path.join(__dirname, '..', '..', 'assets', 'fonts', 'Roboto-Regular.ttf');
      doc.registerFont('Roboto', fontPath);
      doc.font('Roboto');

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      doc.fontSize(12);
      doc.text(text, {
        align: 'justify',
      });

      doc.end();
    });
  }
}
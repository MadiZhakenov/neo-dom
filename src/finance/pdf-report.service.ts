// src\finance\pdf-report.service.ts

import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import { FinanceSummary } from './finance.service';
import * as path from 'path';

@Injectable()
export class PdfReportService {
  async build(summary: FinanceSummary, chartPng?: Buffer): Promise<Buffer> {
    return new Promise<Buffer>((resolve) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });

      const fontPath = path.join(process.cwd(), 'assets', 'fonts', 'Roboto-Regular.ttf');
      doc.registerFont('Roboto', fontPath);
      doc.font('Roboto');

      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(18).text('Финансовый отчёт', { align: 'center' });
      doc.moveDown();

      if (chartPng) {
        doc.image(chartPng, { fit: [500, 250], align: 'center' });
        doc.moveDown();
      }

      doc.fontSize(12).text('Таблица остатков по квартирам:', { align: 'left' });
      doc.moveDown(1); // Добавляем отступ побольше

      // --- НОВАЯ ЛОГИКА ДЛЯ РИСОВАНИЯ ТАБЛИЦЫ ---

      const tableTopY = doc.y; // Запоминаем начальную позицию Y для таблицы
      const startX = 50;
      const col1X = startX;
      const col2X = startX + 200;
      const col3X = startX + 350;
      const rowHeight = 25;
      
      // Функция-помощник для рисования одной строки
      const drawTableRow = (y, apartment, date, amount, isHeader = false) => {
        doc.fontSize(isHeader ? 11 : 10);
        
        // Устанавливаем жирный шрифт для заголовка
        if (isHeader) {
          doc.font(path.join(process.cwd(), 'assets', 'fonts', 'Roboto-Bold.ttf'));
        }
        
        doc.text(apartment, col1X, y);
        doc.text(date, col2X, y);
        doc.text(amount, col3X, y, { align: 'right', width: 100 });
        
        // Возвращаем обычный шрифт после заголовка
        if (isHeader) {
          doc.font(path.join(process.cwd(), 'assets', 'fonts', 'Roboto-Regular.ttf'));
        }
      };
      
      // Рисуем заголовок таблицы
      drawTableRow(tableTopY, 'Квартира', 'Дата', 'Баланс', true);

      // Рисуем разделительную линию под заголовком
      doc.moveTo(startX - 10, tableTopY + 20)
         .lineTo(startX + 460, tableTopY + 20)
         .stroke();

      let currentY = tableTopY + rowHeight;
      
      // Рисуем строки с данными
      summary.rows.forEach((row) => {
        drawTableRow(
          currentY,
          row.apartment,
          row.lastDate,
          row.amount.toFixed(2)
        );
        currentY += rowHeight;
      });

      // Рисуем разделительную линию над "Итого"
      doc.moveTo(startX - 10, currentY)
         .lineTo(startX + 460, currentY)
         .stroke();

      // Рисуем "Итого"
      doc.fontSize(12).font(path.join(process.cwd(), 'assets', 'fonts', 'Roboto-Bold.ttf'));
      doc.text(`Итого: ${summary.total.toFixed(2)}`, startX, currentY + 10, { align: 'right', width: 450 });

      doc.end();
    });
  }
}

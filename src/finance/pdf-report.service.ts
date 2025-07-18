import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import { FinanceSummary } from './finance.service';

@Injectable()
export class PdfReportService {
  async build(summary: FinanceSummary, chartPng?: Buffer): Promise<Buffer> {
    return new Promise<Buffer>((resolve) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(18).text('Финансовый отчёт', { align: 'center' });
      doc.moveDown();

      if (chartPng) {
        const img = doc.image(chartPng, { fit: [500, 250], align: 'center' });
        doc.moveDown();
      }

      doc.fontSize(12).text('Таблица остатков по квартирам:');
      doc.moveDown(0.5);

      // Простая табличка (MVP)
      const colWidths = { apt: 150, date: 100, amt: 100 };
      doc.fontSize(10).text('Квартира', { continued: true, width: colWidths.apt });
      doc.text('Дата', { continued: true, width: colWidths.date });
      doc.text('Баланс', { width: colWidths.amt });
      doc.moveDown(0.2);

      summary.rows.forEach((r) => {
        doc.text(r.apartment, { continued: true, width: colWidths.apt });
        doc.text(r.lastDate, { continued: true, width: colWidths.date });
        doc.text(r.amount.toFixed(2), { width: colWidths.amt });
      });

      doc.moveDown();
      doc.fontSize(12).text(`Итого: ${summary.total.toFixed(2)}`, { align: 'right' });

      doc.end();
    });
  }
}

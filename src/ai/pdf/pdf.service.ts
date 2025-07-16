// src/ai/pdf/pdf.service.ts

import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as path from 'path';

@Injectable()
export class PdfService {
  async createPdfFromText(text: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 72, right: 72 },
      });

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

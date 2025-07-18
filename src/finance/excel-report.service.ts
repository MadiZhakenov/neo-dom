import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { FinanceSummary } from './finance.service';

@Injectable()
export class ExcelReportService {
  async build(summary: FinanceSummary): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Финансы');

    ws.columns = [
      { header: 'Квартира', key: 'apartment', width: 20 },
      { header: 'Дата', key: 'lastDate', width: 15 },
      { header: 'Баланс', key: 'amount', width: 15, style: { numFmt: '#,##0.00' } },
    ];

    summary.rows.forEach((r) => ws.addRow(r));

    const totalRow = ws.addRow({
      apartment: 'Итого',
      lastDate: '',
      amount: summary.total,
    });
    totalRow.font = { bold: true };

    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: ws.rowCount, column: 3 },
    };

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
}

// src\finance\finance.controller.ts

import {
  Controller,
  Get,
  Res,
  Header,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { FinanceService } from './finance.service';
import { ExcelReportService } from './excel-report.service';
import { PdfReportService } from './pdf-report.service';
import { ChartRenderService } from './chart-render.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// TODO: roles guard if needed

@Controller('finance')
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly excelReport: ExcelReportService,
    private readonly pdfReport: PdfReportService,
    private readonly chart: ChartRenderService,
  ) {}

  @Get('summary')
  async getSummary() {
    return this.finance.getSummary();
  }

  @Get('summary.xlsx')
  async getExcel(@Res() res: Response) {
    const summary = await this.finance.getSummary();
    const buf = await this.excelReport.build(summary);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=\"finance-summary.xlsx\"');
    res.send(buf);
  }

  @Get('summary.pdf')
  async getPdf(@Res() res: Response) {
    const summary = await this.finance.getSummary();
    const labels = summary.rows.map((r) => r.apartment);
    const amounts = summary.rows.map((r) => r.amount);
    const chartPng = await this.chart.renderBalanceChart(labels, amounts);
    const buf = await this.pdfReport.build(summary, chartPng);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=\"finance-summary.pdf\"');
    res.send(buf);
  }
}

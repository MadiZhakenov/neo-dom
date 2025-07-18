import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { ExcelReportService } from './excel-report.service';
import { PdfReportService } from './pdf-report.service';
import { ChartRenderService } from './chart-render.service';
import { Apartment } from '../data-import/entities/apartment.entity';
import { Balance } from '../data-import/entities/balance.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Apartment, Balance])],
  controllers: [FinanceController],
  providers: [FinanceService, ExcelReportService, PdfReportService, ChartRenderService],
})
export class FinanceModule {}

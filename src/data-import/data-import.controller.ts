// src\data-import\data-import.controller.ts

import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DataImportService, ImportResult } from './data-import.service';
import { ImportOptionsDto } from './dto/import-options.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('data-import')
@UseGuards(JwtAuthGuard)
export class DataImportController {
  constructor(private readonly dataImportService: DataImportService) {}

  @Post('excel')
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(
    @UploadedFile() file: Express.Multer.File,
    @Query() { mode }: ImportOptionsDto,
  ): Promise<ImportResult> {
    if (!file) {
      throw new BadRequestException('Файл не загружен.');
    }
    return this.dataImportService.importFromExcel(file, { mode });
  }
}

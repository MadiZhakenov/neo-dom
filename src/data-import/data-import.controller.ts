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
import { DataImportService } from './data-import.service';
import { ImportOptionsDto } from './dto/import-options.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// TODO: roles guard if needed

@Controller('data-import')
@UseGuards(JwtAuthGuard)
export class DataImportController {
  constructor(private readonly dataImportService: DataImportService) {}
  @Post('excel')
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(
    @UploadedFile() file: Express.Multer.File,
    @Query() { mode }: ImportOptionsDto,
  ) {
    if (!file) throw new BadRequestException('Файл не загружен.');
    return this.dataImportService.importFromExcel(file, { mode });
  }
}

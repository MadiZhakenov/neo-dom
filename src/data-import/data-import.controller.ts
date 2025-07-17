import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DataImportService } from './data-import.service';
import { ImportOptionsDto } from './dto/import-options.dto';

@UseGuards(JwtAuthGuard)
@Controller('data-import')
export class DataImportController {
  constructor(private readonly dataImportService: DataImportService) {}

  @Post('excel')
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(
    @UploadedFile() file: Express.Multer.File,
    @Query() { mode }: ImportOptionsDto,
  ) {
    return this.dataImportService.importFromExcel(file, { mode });
  }
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataImportController } from './data-import.controller';
import { DataImportService } from './data-import.service';
import { User } from '../users/entities/user.entity';
import { Apartment } from './entities/apartment.entity';
import { Balance } from './entities/balance.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Apartment, Balance])],
  controllers: [DataImportController],
  providers: [DataImportService],
  exports: [TypeOrmModule],
})
export class DataImportModule {}

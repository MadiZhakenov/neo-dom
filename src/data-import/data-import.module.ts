import { Module } from '@nestjs/common';
import { DataImportController } from './data-import.controller';
import { DataImportService } from './data-import.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity'; // для связи
import { Apartment } from './entities/apartment.entity';
import { Balance } from './entities/balance.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Apartment, Balance])],
  controllers: [DataImportController],
  providers: [DataImportService],
})
export class DataImportModule {}

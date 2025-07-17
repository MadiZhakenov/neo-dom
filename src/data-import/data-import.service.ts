import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Apartment } from './entities/apartment.entity';
import { Balance } from './entities/balance.entity';

type Mode = 'append' | 'replace';

interface ImportResult {
  residentsImported: number;
  apartmentsImported: number;
  balancesImported: number;
  errors: string[];
}

@Injectable()
export class DataImportService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Apartment)
    private readonly apartmentRepo: Repository<Apartment>,
    @InjectRepository(Balance)
    private readonly balanceRepo: Repository<Balance>,
  ) {}

  async importFromExcel(file: Express.Multer.File, opts: { mode: Mode }): Promise<ImportResult> {
    if (!file) throw new BadRequestException('Файл не загружен.');

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });

    const residentsSheet = workbook.Sheets['Residents'];
    const apartmentsSheet = workbook.Sheets['Apartments'];
    const balancesSheet = workbook.Sheets['Balances'];

    if (!residentsSheet || !apartmentsSheet || !balancesSheet) {
      throw new BadRequestException(
        'Ожидаются листы: Residents, Apartments, Balances. Проверьте шаблон.',
      );
    }

    const residents = XLSX.utils.sheet_to_json<any>(residentsSheet);
    const apartments = XLSX.utils.sheet_to_json<any>(apartmentsSheet);
    const balances = XLSX.utils.sheet_to_json<any>(balancesSheet);

    const errors: string[] = [];

    return await this.dataSource.transaction(async (manager) => {
      if (opts.mode === 'replace') {
        await manager.clear(Balance);
        await manager.clear(Apartment);
      }

      let residentsImported = 0;
      for (const r of residents) {
        const email = String(r['email'] || '').trim();
        if (!email) {
          errors.push('Пустой email в Residents.');
          continue;
        }

        let user = await manager.findOne(User, { where: { email } });
        if (!user) {
          user = manager.create(User, {
            email,
            password_hash: 'temp', // TODO: нормальный пароль/инвайт
            tariff: r['tariff'] || 'Базовый',
            full_name: r['full_name'] || null,
            phone: r['phone'] || null,
            role: r['role'] || 'resident',
          });
        } else {
          // обновляем
          user.full_name = r['full_name'] ?? user.full_name;
          user.phone = r['phone'] ?? user.phone;
          user.tariff = r['tariff'] ?? user.tariff;
          user.role = (r['role'] as any) || user.role;
        }
        await manager.save(User, user);
        residentsImported++;
      }

      let apartmentsImported = 0;
      for (const a of apartments) {
        const number = String(a['number'] || '').trim();
        if (!number) {
          errors.push('Пустой number в Apartments.');
          continue;
        }

        const ownerEmail = (a['owner_email'] || '').trim();
        let owner: User | null = null;
        if (ownerEmail) {
          owner = await manager.findOne(User, { where: { email: ownerEmail } });
          if (!owner) {
            errors.push(`Owner email ${ownerEmail} не найден (Apartment ${number}).`);
          }
        }

        let apartment = await manager.findOne(Apartment, { where: { number } });
        if (!apartment) {
          apartment = manager.create(Apartment, {
            number,
            address: a['address'] || '',
            resident: owner ?? null,
          });
        } else {
          apartment.address = a['address'] ?? apartment.address;
          apartment.resident = owner ?? apartment.resident;
        }
        await manager.save(Apartment, apartment);
        apartmentsImported++;
      }

      let balancesImported = 0;
      for (const b of balances) {
        const aptNumber = String(b['apartment_number'] || '').trim();
        const amountRaw = b['amount'];
        const amount = amountRaw === undefined || amountRaw === null ? 0 : Number(amountRaw);

        if (!aptNumber) {
          errors.push('Пустой apartment_number в Balances.');
          continue;
        }

        const apartment = await manager.findOne(Apartment, { where: { number: aptNumber } });
        if (!apartment) {
          errors.push(`Апартамент ${aptNumber} для баланса не найден.`);
          continue;
        }

        const balance = manager.create(Balance, {
          apartment,
          amount,
        });
        await manager.save(Balance, balance);
        balancesImported++;
      }

      return {
        residentsImported,
        apartmentsImported,
        balancesImported,
        errors,
      };
    });
  }
}

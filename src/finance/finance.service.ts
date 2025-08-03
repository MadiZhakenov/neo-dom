// src\finance\finance.service.ts

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Apartment } from '../data-import/entities/apartment.entity';
import { Balance } from '../data-import/entities/balance.entity';

export interface FinanceRow {
  apartment: string;
  lastDate: string;
  amount: number;
}

export interface FinanceSummary {
  total: number;
  rows: FinanceRow[];
}

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(Apartment) private readonly aptRepo: Repository<Apartment>,
    @InjectRepository(Balance) private readonly balRepo: Repository<Balance>,
  ) {}

  async getSummary(): Promise<FinanceSummary> {
    const all = await this.balRepo.find({ relations: ['apartment'] });

    const latestMap = new Map<number, Balance>();
    for (const b of all) {
      const existing = latestMap.get(b.apartment.id);
      if (!existing) {
        latestMap.set(b.apartment.id, b);
      } else {
        const d1 = existing.as_of_date;
        const d2 = b.as_of_date;
        if (d2 > d1) latestMap.set(b.apartment.id, b);
      }
    }

    const rows: FinanceRow[] = [];
    let total = 0;

    for (const [, bal] of latestMap) {
      const amountNum = Number(bal.amount);
      total += amountNum;
      rows.push({
        apartment: bal.apartment.number,
        lastDate: bal.as_of_date,
        amount: amountNum,
      });
    }

    rows.sort((a, b) => a.apartment.localeCompare(b.apartment, 'ru', { numeric: true }));

    return { total, rows };
  }
}

import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('receipts')
@UseGuards(JwtAuthGuard)
export class ApartmentController {
  
  private data = {
    current: [
      { id: 1, category: '💧 Водоснабжение', provider: 'Астана Су Арнасы', amount: 3850.50, status: 'unpaid' },
      { id: 2, category: '⚡️ Электроэнергия', provider: 'Астана-РЭК', amount: 4200.00, status: 'unpaid' },
      { id: 3, category: '🌡 Отопление', provider: 'Теплотранзит', amount: 6100.00, status: 'paid' },
      { id: 4, category: '🏢 Содержание дома', provider: 'ОСИ "Наш Дом"', amount: 4500.00, status: 'unpaid' },
    ],
    archive: [
      { 
        month: 'Сентябрь 2025', 
        total: 18550.50, 
        details: [
          { id: 6, category: '💧 Водоснабжение', amount: 3850.50 },
          { id: 7, category: '⚡️ Электроэнергия', amount: 4200.00 },
          { id: 8, category: '🌡 Отопление', amount: 6000.00 },
          { id: 9, category: '🏢 Содержание дома', amount: 4500.00 },
        ]
      },
      { 
        month: 'Август 2025', 
        total: 18400.00,
        details: [
          { id: 11, category: '💧 Водоснабжение', amount: 3800.00 },
          { id: 12, category: '⚡️ Электроэнергия', amount: 4150.00 },
          { id: 13, category: '🌡 Отопление', amount: 5950.00 },
          { id: 14, category: '🏢 Содержание дома', amount: 4500.00 },
        ]
      },
      { 
        month: 'Июль 2025', 
        total: 18250.00,
        details: [
          { id: 16, category: '💧 Водоснабжение', amount: 3750.00 },
          { id: 17, category: '⚡️ Электроэнергия', amount: 4100.00 },
          { id: 18, category: '🌡 Отопление', amount: 5900.00 },
          { id: 19, category: '🏢 Содержание дома', amount: 4500.00 },
        ]
      },
      { 
        month: 'Июнь 2025', 
        total: 18000.00,
        details: [
          { id: 21, category: '💧 Водоснабжение', amount: 3700.00 },
          { id: 22, category: '⚡️ Электроэнергия', amount: 4050.00 },
          { id: 23, category: '🌡 Отопление', amount: 5850.00 },
          { id: 24, category: '🏢 Содержание дома', amount: 4500.00 },
        ]
      },
      { 
        month: 'Май 2025', 
        total: 17750.00,
        details: [
          { id: 26, category: '💧 Водоснабжение', amount: 3650.00 },
          { id: 27, category: '⚡️ Электроэнергия', amount: 4000.00 },
          { id: 28, category: '🌡 Отопление', amount: 5800.00 },
          { id: 29, category: '🏢 Содержание дома', amount: 4500.00 },
        ]
      },
      { 
        month: 'Апрель 2025', 
        total: 17500.00,
        details: [
          { id: 31, category: '💧 Водоснабжение', amount: 3600.00 },
          { id: 32, category: '⚡️ Электроэнергия', amount: 3950.00 },
          { id: 33, category: '🌡 Отопление', amount: 5750.00 },
          { id: 34, category: '🏢 Содержание дома', amount: 4500.00 },
        ]
      },
      { 
        month: 'Март 2025', 
        total: 18800.00,
        details: [
          { id: 36, category: '💧 Водоснабжение', amount: 3700.00 },
          { id: 37, category: '⚡️ Электроэнергия', amount: 4200.00 },
          { id: 38, category: '🌡 Отопление', amount: 6400.00 },
          { id: 39, category: '🏢 Содержание дома', amount: 4500.00 },
        ]
      },
    ],
    total_debt: 12550.50 // Добавляем общую сумму неоплаченных счетов
  };

  @Get()
  getReceiptsData() {
    return this.data;
  }
  
  @Post('pay/:id')
  payReceipt(@Param('id') id: string) {
    const receipt = this.data.current.find(r => r.id === parseInt(id, 10));
    if (receipt) {
      receipt.status = 'paid';
      // Пересчитываем общий долг после оплаты одной квитанции
      this.calculateTotalDebt();
    }
    return { message: 'OK' };
  }

  @Post('pay/all')
  payAllReceipts() {
    this.data.current.forEach(r => { 
        if (r.status === 'unpaid') r.status = 'paid'; 
    });
    this.calculateTotalDebt(); // Пересчитываем долг
    return { message: 'Все счета успешно оплачены' };
}

  private calculateTotalDebt() {
    this.data.total_debt = this.data.current
      .filter(r => r.status === 'unpaid')
      .reduce((total, receipt) => total + receipt.amount, 0);
  }
}
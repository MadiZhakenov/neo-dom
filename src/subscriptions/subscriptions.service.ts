import { HttpService } from '@nestjs/axios';
import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class SubscriptionsService {
  private readonly appleSandboxUrl = 'https://sandbox.itunes.apple.com/verifyReceipt';
  private readonly appleProductionUrl = 'https://buy.itunes.apple.com/verifyReceipt';
  private readonly sharedSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly usersService: UsersService,
  ) {
    // Получаем ключ из конфигурации
    const secret = this.configService.get<string>('APPLE_IAP_SHARED_SECRET');
    
    // ПРОВЕРЯЕМ, что ключ действительно существует.
    if (!secret) {
      // Если ключа нет, "роняем" приложение при запуске с понятной ошибкой.
      // Это предотвратит ошибки во время работы.
      throw new Error('APPLE_IAP_SHARED_SECRET не найден в .env файле! Модуль подписок не может работать.');
    }
    
    // Если проверка пройдена, присваиваем значение.
    // Теперь TypeScript уверен, что 'secret' - это строка.
    this.sharedSecret = secret;
  }
  
  /**
   * Проверяет квитанцию Apple и активирует подписку для пользователя.
   * @param userId - ID пользователя, который совершил покупку.
   * @param receipt - Строка квитанции из iOS-приложения.
   */
  async verifyAppleSubscription(userId: number, receipt: string) {
    const appleUrl = process.env.NODE_ENV === 'production' ? this.appleProductionUrl : this.appleSandboxUrl;

    try {
      const response = await lastValueFrom(
        this.httpService.post(appleUrl, {
          'receipt-data': receipt,
          'password': this.sharedSecret,
          'exclude-old-transactions': true,
        }),
      );

      const appleResponse = response.data;

      // Apple рекомендует сначала проверять статус 21007 (это значит, что мы стучимся в прод с сэндбокс-квитанцией)
      if (appleResponse.status === 21007) {
        return this.verifyAppleSubscriptionInSandbox(userId, receipt);
      }

      if (appleResponse.status !== 0) {
        throw new BadRequestException(`Невалидная квитанция. Статус Apple: ${appleResponse.status}`);
      }

      // Находим самую последнюю транзакцию
      const latestTransaction = appleResponse.latest_receipt_info[0];
      const productId = latestTransaction.product_id;
      const expiresDateMs = parseInt(latestTransaction.expires_date_ms, 10);
      const expirationDate = new Date(expiresDateMs);

      // Проверяем, что подписка премиальная и не истекла
      if (productId.includes('premium') && expirationDate > new Date()) {
        await this.usersService.activatePremium(userId, expirationDate);
        return { success: true, message: 'Премиум-подписка успешно активирована.' };
      } else {
        await this.usersService.deactivatePremium(userId);
        throw new BadRequestException('Подписка не является премиальной или истекла.');
      }
    } catch (error) {
      console.error('Ошибка верификации Apple IAP:', error);
      throw new BadRequestException('Не удалось проверить квитанцию.');
    }
  }
  
  // Приватный метод для повторной проверки в сэндбоксе
  private async verifyAppleSubscriptionInSandbox(userId: number, receipt: string) {
    // Логика почти такая же, как в основном методе, но URL всегда sandbox
    // ... (можно вынести общую логику в отдельный метод, чтобы не дублировать код)
    console.log('Повторная проверка в Sandbox...');
    // Здесь должна быть реализация, аналогичная основному методу, но с `appleSandboxUrl`
    // Это домашнее задание :)
    return { success: false, message: 'Требуется проверка в Sandbox' };
  }
}
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
    const secret = this.configService.get<string>('APPLE_IAP_SHARED_SECRET');
    if (!secret) {
      throw new Error('APPLE_IAP_SHARED_SECRET не найден в .env файле!');
    }
    this.sharedSecret = secret;
  }

  /**
   * Главный публичный метод. Начинает проверку с production URL.
   * @param userId - ID пользователя.
   * @param receipt - Квитанция от Apple.
   */
  async verifyAppleSubscription(userId: number, receipt: string) {
    // По умолчанию всегда стучимся в прод, как рекомендует Apple
    const appleUrl = this.appleProductionUrl;
    return this._handleAppleVerification(userId, receipt, appleUrl, true); // Добавляем флаг isProduction
  }

  /**
   * Приватный "рабочий" метод, содержащий всю логику верификации.
   * @param userId - ID пользователя.
   * @param receipt - Квитанция.
   * @param appleUrl - URL для проверки (prod или sandbox).
   * @param isProduction - Флаг, указывающий, является ли это первой проверкой на проде.
   */
  private async _handleAppleVerification(userId: number, receipt: string, appleUrl: string, isProduction: boolean = false) {
    try {
      const response = await lastValueFrom(
        this.httpService.post(appleUrl, {
          'receipt-data': receipt,
          password: this.sharedSecret,
          'exclude-old-transactions': true,
        }),
      );

      const appleResponse = response.data;

      if (isProduction && (appleResponse.status === 21007 || appleResponse.status === 21002)) {
        console.log(`Получен статус ${appleResponse.status} от прода. Повторяем запрос в Sandbox...`);
        return this._handleAppleVerification(userId, receipt, this.appleSandboxUrl);
      }

      if (appleResponse.status !== 0) {
        throw new BadRequestException(`Невалидная квитанция. Статус Apple: ${appleResponse.status}`);
      }
      
      // --- НОВАЯ ЗАЩИТНАЯ ПРОВЕРКА ---
      // Проверяем, есть ли вообще информация о покупках в ответе.
      if (!appleResponse.latest_receipt_info || appleResponse.latest_receipt_info.length === 0) {
        // Если массив пуст или отсутствует, значит, это валидная квитанция, но без покупок.
        throw new BadRequestException('Квитанция валидна, но не содержит данных о покупках.');
      }
      // --- КОНЕЦ ПРОВЕРКИ ---

      const latestTransaction = appleResponse.latest_receipt_info[0];
      const productId = latestTransaction.product_id;
      const expiresDateMs = parseInt(latestTransaction.expires_date_ms, 10);
      const expirationDate = new Date(expiresDateMs);

      if (productId.includes('premium') && expirationDate > new Date()) {
        await this.usersService.activatePremium(userId, expirationDate);
        return { success: true, message: `Премиум-подписка успешно активирована (среда: ${isProduction ? 'prod' : 'sandbox'}).` };
      } else {
        await this.usersService.deactivatePremium(userId);
        throw new BadRequestException('Последняя покупка не является активной премиум-подпиской.');
      }
    } catch (error) {
      console.error('Ошибка верификации Apple IAP:', error?.response?.data || error.message || error);
      // Если это уже известная ошибка BadRequest, просто пробрасываем ее дальше
      if (error instanceof BadRequestException) {
        throw error;
      }
      // Иначе оборачиваем в нашу
      throw new BadRequestException('Не удалось проверить квитанцию.');
    }
  }
}
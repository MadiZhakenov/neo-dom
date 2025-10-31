import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, Timeout } from '@nestjs/schedule';
import { UsersService } from '../users/users.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(private readonly usersService: UsersService) {}

  @Timeout(15000)
  handleInitialCheck() {
    this.logger.log('Выполняется отложенная первоначальная проверка истекших подписок...');
    this.handleExpiredSubscriptions();
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleExpiredSubscriptions() {
    this.logger.log('Запущена проверка истекших премиум-подписок...');
    try {
      const deactivatedCount = await this.usersService.deactivateExpiredPremiums();
      if (deactivatedCount > 0) {
        this.logger.log(`Успешно деактивировано ${deactivatedCount} подписок.`);
      } else {
        this.logger.log('Истекших подписок не найдено.');
      }
    } catch (error) {
      this.logger.error('Ошибка при обработке истекших подписок:', error.message);
    }
  }
}
/**
 * @file src/app.service.ts
 * @description Корневой сервис приложения.
 */

import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  /**
   * Возвращает простое приветственное сообщение.
   * @returns Строка 'Hello World!'.
   */
  getHello(): string {
    return 'Hello World!';
  }
}
/**
 * @file src/app.controller.ts
 * @description Корневой контроллер приложения.
 * Часто используется для проверки работоспособности (health check).
 */

import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Простой GET-эндпоинт, который возвращает приветственное сообщение.
   * @returns Строка 'Hello World!'.
   */
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
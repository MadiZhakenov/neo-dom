/**
 * @file src/app.service.ts
 * @description Корневой сервис приложения.
 */

import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {

  getHello(): string {
    return 'Hello World!';
  }
}
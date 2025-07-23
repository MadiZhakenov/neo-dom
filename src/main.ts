/**
 * @file src/main.ts
 * @description Главный файл, точка входа в приложение NestJS.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Главная асинхронная функция для запуска приложения.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Запускаем сервер на порту из .env или на 3000 по умолчанию
  await app.listen(process.env.PORT ?? 3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}

bootstrap();
// src/main.ts
import * as crypto from 'crypto';

if (!global.crypto) {
  Object.defineProperty(global, 'crypto', {
    value: {
      randomUUID: () => crypto.randomUUID(),
    },
    configurable: true,
  });
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import axios from 'axios';

// --- НАШ СЕКРЕТНЫЙ РУБИЛЬНИК ---
const STATUS_URL = 'https://api.jsonbin.io/v3/b/68ac938543b1c97be929bd6c';

async function checkAppStatus() {
  try {
    const response = await axios.get(STATUS_URL);
    // Проверяем поле "status" в полученном JSON
    if (response.data?.record?.status !== 'ENABLED') {
      console.error('Application status is not ENABLED. Shutting down.');
      process.exit(1);
    }
    console.log('Application status check passed.');
  } catch (error) {
    console.error('Failed to check application status. Shutting down.', error.message);
    process.exit(1);
  }
}
// --- КОНЕЦ БЛОКА РУБИЛЬНИКА ---


async function bootstrap() {
  await checkAppStatus(); // <-- ПРОВЕРКА ПЕРЕД СТАРТОМ

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Настраиваем раздачу статики (CSS, JS файлы, если будут)
  app.useStaticAssets(join(__dirname, '..', 'public'));
  // Указываем, где лежат наши "view" (шаблоны)
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  // Устанавливаем hbs как движок для рендеринга
  app.setViewEngine('hbs');

  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
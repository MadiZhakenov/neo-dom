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
import axios from 'axios'; // <-- Добавлен axios

const STATUS_URL = 'https://gist.githubusercontent.com/MadiZhakenov/bff2f727348cc6bc2f3d7dd8dc5754ca/raw/93284fdc60cc49a87c11c6f9f37b4809fa2c43af/neo-osi-status.txt';

async function checkAppStatus() {
  try {
    const response = await axios.get(STATUS_URL);
    if (response.data.trim() !== 'ENABLED') {
      console.error('Application status is not ENABLED. Shutting down.');
      process.exit(1);
    }
    console.log('Application status check passed.');
  } catch (error) {
    console.error('Failed to check application status. Shutting down.', error.message);
    process.exit(1);
  }
}



async function bootstrap() {
  await checkAppStatus();

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
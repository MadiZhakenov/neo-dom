// 1. Импортируем 'crypto'
import * as crypto from 'crypto';

// 2. Явно "внедряем" его в глобальный объект Web Crypto API,
// на который, скорее всего, рассчитывает @nestjs/typeorm.
// Это называется "полифилл".
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

async function bootstrap() {
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
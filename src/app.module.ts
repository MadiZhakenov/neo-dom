/**
 * @file src/app.module.ts
 * @description Корневой модуль приложения NestJS.
 * Собирает все функциональные модули, настраивает конфигурацию и подключение к базе данных.
 */

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiModule } from './ai/ai.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { DataImportModule } from './data-import/data-import.module';
import { ChatModule } from './chat/chat.module';
import { DocumentsModule } from './documents/documents.module';

@Module({
  imports: [
    // Глобальный модуль конфигурации для доступа к .env файлам
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Асинхронная настройка подключения к базе данных PostgreSQL
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: parseInt(configService.get<string>('DB_PORT', '5432')),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'], // Автоматическая загрузка всех сущностей
        synchronize: true, // ВНИМАНИЕ: true только для разработки. Автоматически применяет схему.
        logging: configService.get<string>('DB_LOGGING') === 'true',
      }),
    }),
    // Подключение всех функциональных модулей приложения
    AiModule,
    UsersModule,
    AuthModule,
    DataImportModule,
    DocumentsModule,
    ChatModule,
  ],
  controllers: [AppController], // Корневой контроллер
  providers: [AppService], // Корневой сервис
})
export class AppModule {}
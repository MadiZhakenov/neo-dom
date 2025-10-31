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
import { ChatModule } from './chat/chat.module';
import { DocumentsModule } from './documents/documents.module';
import { ScheduleModule } from '@nestjs/schedule';
import { GeneratedDocument } from './documents/entities/generated-document.entity';
import { DashboardModule } from './dashboard/dashboard.module';
import { TasksModule } from './tasks/tasks.module';
import { ApartmentModule } from './apartment/apartment.module'; 

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),

        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        synchronize: false,
        logging: configService.get<string>('DB_LOGGING') === 'true',
      }),
    }),
    
    AiModule,
    UsersModule,
    AuthModule,
    DocumentsModule,
    ChatModule,
    GeneratedDocument,DashboardModule,
    TasksModule,
    ApartmentModule

  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
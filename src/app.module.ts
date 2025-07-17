import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AiModule } from './ai/ai.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';

import { DataImportModule } from './data-import/data-import.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: parseInt(configService.get<string>('DB_PORT', '5432')),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: true,
        logging: configService.get<string>('DB_LOGGING') === 'true',
      }),
      inject: [ConfigService],
    }),

    AiModule,
    UsersModule,
    AuthModule,
    DataImportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

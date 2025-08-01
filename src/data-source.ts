import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';

// Загружаем переменные окружения из .env файла
dotenv.config();

/**
 * Эта функция читает конфигурацию из .env, проверяет ее
 * и возвращает готовый объект для TypeORM.
 */
function getDataSourceOptions(): DataSourceOptions {
  // 1. Получаем все переменные
  const {
    DB_HOST,
    DB_PORT,
    DB_USERNAME,
    DB_PASSWORD,
    DB_DATABASE,
  } = process.env;

  // 2. Проверяем, что они все существуют
  if (!DB_HOST || !DB_PORT || !DB_USERNAME || !DB_PASSWORD || !DB_DATABASE) {
    throw new Error('Критическая ошибка: Одна или несколько обязательных переменных для подключения к базе данных не найдены в .env файле!');
  }

  // 3. Если все на месте, возвращаем конфигурацию.
  // TypeScript теперь уверен, что здесь нет undefined.
  return {
    type: 'postgres',
    host: DB_HOST,
    port: parseInt(DB_PORT, 10),
    username: DB_USERNAME,
    password: DB_PASSWORD,
    database: DB_DATABASE,
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    synchronize: false,
  };
}

// Создаем и экспортируем DataSource на основе проверенной конфигурации
const AppDataSource = new DataSource(getDataSourceOptions());
export default AppDataSource;
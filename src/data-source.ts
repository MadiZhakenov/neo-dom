import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

// Эта конфигурация будет использоваться и локально, и на Render
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  
  // TypeORM достаточно умен, чтобы распарсить все из одной строки DATABASE_URL
  // Он будет использовать ее, если она есть (на Render)
  url: process.env.DATABASE_URL,
  
  // А если DATABASE_URL нет, он будет использовать эти переменные (локально)
  // Добавляем проверку, что DB_PORT существует, перед тем как его парсить
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
};

const AppDataSource = new DataSource(dataSourceOptions);
export default AppDataSource;
# Этап 1: Сборка приложения
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Этап 2: Создание "боевого" образа
FROM node:18-alpine
WORKDIR /app
# Копируем только необходимые для запуска файлы из этапа сборки
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Запускаем приложение
CMD ["node", "dist/main"]
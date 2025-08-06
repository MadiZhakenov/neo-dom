# Этап 1: Сборка приложения
# Мы используем полную версию node:18-alpine, а не slim, чтобы были доступны инструменты
FROM node:18-alpine AS builder

# Устанавливаем системные зависимости, необходимые для компиляции 'canvas'
# build-base - это компиляторы (make, g++, etc.)
# python3 - нужен для node-gyp
# cairo-dev, jpeg-dev, ... - это библиотеки для работы с графикой
RUN apk add --no-cache build-base g++ cairo-dev jpeg-dev pango-dev giflib-dev python3

WORKDIR /app

COPY package*.json ./

# Устанавливаем зависимости. Теперь у npm будут все инструменты для сборки canvas.
RUN npm install

COPY . .

RUN npm run build

# Этап 2: Создание "боевого" образа
FROM node:18-alpine

# Устанавливаем ТОЛЬКО те системные зависимости, которые нужны для ЗАПУСКА, а не для сборки.
# Это делает итоговый образ меньше и безопаснее.
RUN apk add --no-cache cairo jpeg pango giflib

WORKDIR /app

# Копируем только необходимые для запуска файлы из этапа сборки
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Запускаем приложение
CMD ["node", "dist/main"]
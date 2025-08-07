# Этап 1: Сборка приложения
FROM node:18-alpine AS builder

# Устанавливаем системные зависимости...
RUN apk add --no-cache build-base g++ cairo-dev jpeg-dev pango-dev giflib-dev python3

WORKDIR /app

COPY package*.json ./

RUN npm install

# Копируем ВЕСЬ код, включая папку knowledge_base
COPY . .

# --- НОВАЯ КОМАНДА: ЗАПУСКАЕМ СКРИПТ КЭШИРОВАНИЯ ---
# Мы запускаем его здесь, после того как скопировали все файлы
RUN node cache-knowledge-base.js

# Собираем основной проект
RUN npm run build

# Этап 2: Создание "боевого" образа
FROM node:18-alpine

# ... остальная часть файла без изменений ...
RUN apk add --no-cache cairo jpeg pango giflib

WORKDIR /app

# Копируем скомпилированный код
COPY --from=builder /app/dist ./dist
# Копируем зависимости
COPY --from=builder /app/node_modules ./node_modules
# Копируем package.json
COPY --from=builder /app/package*.json ./

# --- ВАЖНО: КОПИРУЕМ СОЗДАННЫЙ КЭШ ---
COPY --from=builder /app/.pdf-cache ./.pdf-cache

# Запускаем приложение
CMD ["node", "dist/main"]
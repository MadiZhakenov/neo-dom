# Этап 1: Сборка приложения
FROM node:18-alpine AS builder

# --- ИЗМЕНЕНИЕ: Указываем правильную рабочую директорию ---
# Вместо /app мы будем использовать /neo-osi-backend (или любое другое имя)
# Это предотвратит путаницу со стандартной /app
WORKDIR /neo-osi-backend

# Устанавливаем системные зависимости...
RUN apk add --no-cache build-base g++ cairo-dev jpeg-dev pango-dev giflib-dev python3

# Копируем сначала package.json для кэширования слоев
COPY package*.json ./
RUN npm install

# Теперь копируем ВЕСЬ остальной код
COPY . .

# Запускаем скрипт кэширования
RUN node cache-knowledge-base.js

# Собираем основной проект
RUN npm run build

# Этап 2: Создание "боевого" образа
FROM node:18-alpine

RUN apk add --no-cache cairo jpeg pango giflib

# Устанавливаем ту же рабочую директорию
WORKDIR /neo-osi-backend

# Копируем необходимые файлы из этапа сборки
COPY --from=builder /neo-osi-backend/dist ./dist
COPY --from=builder /neo-osi-backend/node_modules ./node_modules
COPY --from=builder /neo-osi-backend/package*.json ./
COPY --from=builder /neo-osi-backend/.pdf-cache ./.pdf-cache

# Запускаем приложение
CMD ["node", "dist/main"]```
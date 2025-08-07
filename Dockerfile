# =============================================================
# Этап 1: "Dependencies" - Установка зависимостей
# =============================================================
FROM node:18-alpine AS deps
WORKDIR /neo-osi-backend

# Устанавливаем системные зависимости
RUN apk add --no-cache build-base g++ cairo-dev jpeg-dev pango-dev giflib-dev python3

# Копируем package.json и устанавливаем ВСЕ зависимости
COPY package*.json ./
RUN npm install

# =============================================================
# Этап 2: "Builder" - Сборка проекта
# =============================================================
FROM node:18-alpine AS builder
WORKDIR /neo-osi-backend

# Копируем ВСЕ зависимости, установленные на предыдущем этапе
COPY --from=deps /neo-osi-backend/node_modules ./node_modules
# Копируем остальной код
COPY . .

# Запускаем скрипт кэширования
RUN npm run cache

# Собираем TypeScript в JavaScript
RUN npm run build

# =============================================================
# Этап 3: "Production" - Финальный, "чистый" образ
# =============================================================
FROM node:18-alpine
WORKDIR /neo-osi-backend

# --- ИСПРАВЛЕНИЕ: ДОБАВЛЯЕМ УСТАНОВКУ ЗАВИСИМОСТЕЙ И СЮДА ---
# 'canvas' требует их не только для сборки, но и для запуска.
RUN apk add --no-cache build-base g++ cairo-dev jpeg-dev pango-dev giflib-dev python3

# Копируем package.json и устанавливаем ТОЛЬКО production-зависимости
COPY package*.json ./
RUN npm install --omit=dev

# Копируем скомпилированный код и все ассеты из этапа "Builder"
COPY --from=builder /neo-osi-backend/dist ./dist
COPY --from=builder /neo-osi-backend/.pdf-cache ./.pdf-cache
COPY --from=builder /neo-osi-backend/knowledge_base ./knowledge_base
COPY --from=builder /neo-osi-backend/views ./views
COPY --from=builder /neo-osi-backend/assets ./assets

# Запускаем приложение
CMD ["node", "dist/main"]
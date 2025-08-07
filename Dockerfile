# Этап 1: "Builder" - Сборочный цех
FROM node:18-alpine AS builder
WORKDIR /neo-osi-backend
# Устанавливаем системные зависимости для сборки
RUN apk add --no-cache build-base g++ cairo-dev jpeg-dev pango-dev giflib-dev python3
# ... остальной код первого этапа (COPY, npm install, COPY, npm run cache, npm run build) ...


# =============================================================
# Этап 2: "Production" - Финальный, "чистый" образ
# =============================================================
FROM node:18-alpine
WORKDIR /neo-osi-backend

# --- ИСПРАВЛЕНИЕ: ДОБАВЛЯЕМ УСТАНОВКУ ЗАВИСИМОСТЕЙ И СЮДА ---
# 'canvas' требует их не только для сборки, но и для запуска.
RUN apk add --no-cache build-base g++ cairo-dev jpeg-dev pango-dev giflib-dev python3

# Копируем package.json и устанавливаем ТОЛЬКО production-зависимости
COPY package*.json ./
RUN npm install --omit=dev

# Копируем скомпилированный код и ассеты из этапа "Builder"
COPY --from=builder /neo-osi-backend/dist ./dist
# ... остальной код второго этапа (COPY и CMD) ...
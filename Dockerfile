# =============================================================
# Этап 1: "Builder" - Сборочный цех
# Здесь есть все инструменты: TypeScript, компиляторы, Python
# =============================================================
FROM node:18-alpine AS builder

WORKDIR /neo-osi-backend

# Устанавливаем системные зависимости для сборки 'canvas'
RUN apk add --no-cache build-base g++ cairo-dev jpeg-dev pango-dev giflib-dev python3

# Копируем package.json и устанавливаем ВСЕ зависимости (включая devDependencies)
COPY package*.json ./
RUN npm install

# Копируем весь остальной код
COPY . .

# Запускаем скрипт кэширования
RUN npm run cache

# Собираем TypeScript в JavaScript
RUN npm run build

# =============================================================
# Этап 2: "Production" - Финальный, "чистый" образ
# Здесь только то, что нужно для ЗАПУСКА. Нет TypeScript, нет Python.
# =============================================================
FROM node:18-alpine

WORKDIR /neo-osi-backend

# Устанавливаем ТОЛЬКО те системные зависимости, которые нужны для работы 'canvas'
RUN apk add --no-cache cairo jpeg pango giflib

# Копируем package.json и устанавливаем ТОЛЬКО production-зависимости
# Это делает образ меньше и безопаснее
COPY package*.json ./
RUN npm install --omit=dev

# Копируем скомпилированный код и ассеты из этапа "Builder"
COPY --from=builder /neo-osi-backend/dist ./dist
COPY --from=builder /neo-osi-backend/.pdf-cache ./.pdf-cache
COPY --from=builder /neo-osi-backend/knowledge_base ./knowledge_base
COPY --from=builder /neo-osi-backend/views ./views

# Запускаем приложение
CMD ["node", "dist/main"]
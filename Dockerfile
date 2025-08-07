# Этап 1: Сборка приложения
FROM node:18-alpine AS builder

WORKDIR /neo-osi-backend

# Устанавливаем системные зависимости, если нужны для canvas
RUN apk add --no-cache build-base g++ cairo-dev jpeg-dev pango-dev giflib-dev python3

# --- ИСПРАВЛЕНИЕ: МЕНЯЕМ ПОРЯДОК ---
# 1. Сначала копируем package.json и package-lock.json
COPY package*.json ./

# 2. Теперь запускаем npm install. Он найдет package.json.
RUN npm install

# 3. Теперь копируем ВЕСЬ остальной код
COPY . .
# --- КОНЕЦ ИСПРАВЛЕНИЯ ---

# Запускаем скрипт кэширования
RUN npm run cache

# Собираем основной проект
RUN npm run build


# Копируем необходимые файлы
COPY --from=builder /neo-osi-backend/dist ./dist
COPY --from=builder /neo-osi-backend/node_modules ./node_modules
COPY --from=builder /neo-osi-backend/package*.json ./
COPY --from=builder /neo-osi-backend/.pdf-cache ./.pdf-cache


# Копируем всю базу знаний, включая шаблоны
COPY --from=builder /neo-osi-backend/knowledge_base ./knowledge_base

# Копируем шаблоны для рендеринга
COPY --from=builder /neo-osi-backend/views ./views

# Запускаем приложение
CMD ["node", "dist/main"]
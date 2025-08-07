FROM node:18-alpine AS builder

WORKDIR /neo-osi-backend

# Устанавливаем системные зависимости
RUN apk add --no-cache build-base g++ cairo-dev jpeg-dev pango-dev giflib-dev python3

COPY package*.json ./
RUN npm install

# Копируем ВЕСЬ код, включая .pdf-cache, который мы сгенерируем локально
COPY . .

# Собираем основной проект
RUN npm run build

# Этап 2: Создание "боевого" образа
FROM node:18-alpine

RUN apk add --no-cache cairo jpeg pango giflib

WORKDIR /neo-osi-backend

# Копируем необходимые файлы
COPY --from=builder /neo-osi-backend/dist ./dist
COPY --from=builder /neo-osi-backend/node_modules ./node_modules
COPY --from=builder /neo-osi-backend/package*.json ./
COPY --from=builder /neo-osi-backend/.pdf-cache ./.pdf-cache # <-- Эта команда теперь будет работать

# Запускаем приложение
CMD ["node", "dist/main"]
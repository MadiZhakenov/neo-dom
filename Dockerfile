# Этап 1: Сборка приложения
FROM node:18-alpine AS builder
WORKDIR /neo-osi-backend
# ...
RUN npm install
COPY . .
# ...
RUN npm run build

# Этап 2: Создание "боевого" образа
FROM node:18-alpine
WORKDIR /neo-osi-backend
# ...

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
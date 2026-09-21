# Prototipo de despliegue (Railway). Build context = raiz del repo, porque
# el frontend depende del workspace packages/types.
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/assistant/package.json packages/assistant/package.json

RUN npm ci

COPY packages ./packages
COPY apps/frontend ./apps/frontend

RUN npm run build -w @crm/frontend

# --- Imagen final: solo los estaticos + nginx ---
FROM nginx:alpine

COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

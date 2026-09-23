# Prototipo de despliegue (Railway). Build context = raiz del repo, porque
# el backend depende de los workspaces packages/types y packages/assistant.
#
# No compila a JS: usa tsx en produccion, igual que "npm run dev" en local.
# Es la forma mas simple de desplegar este monorepo tal cual esta hoy.
FROM node:20-alpine

WORKDIR /app

# Copiamos primero solo los package.json de todos los workspaces para que
# "npm ci" pueda validar el lockfile sin traer el codigo fuente aun (cache
# de capas: si no cambian dependencias, este paso no se repite).
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/assistant/package.json packages/assistant/package.json

RUN npm ci

COPY packages ./packages
COPY apps/backend ./apps/backend

RUN npm run db:generate -w @crm/backend

ENV NODE_ENV=production
EXPOSE 5000

# Aplica migraciones pendientes y arranca. Es idempotente: correr de nuevo
# en el siguiente deploy no rompe nada si no hay migraciones nuevas.
CMD ["sh", "-c", "npm run db:deploy -w @crm/backend && npx tsx apps/backend/src/index.ts"]

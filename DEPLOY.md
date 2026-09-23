# Desplegar el prototipo en Railway

Esta guía monta una versión de prueba de CRM Iguana en la nube. Es un
prototipo: simple, funcional, sin optimizar para producción real (sin
backups automáticos, sin escalado, sin CDN). Sirve para mostrarlo y
probarlo con datos reales, no para operar el negocio todavía.

No toca la rama principal del repo: todo esto vive en una rama aparte.

## Qué se creó para esto

- `apps/backend/Dockerfile` — imagen del API (Express + Prisma), corre
  migraciones al arrancar y levanta el servidor con `tsx`, igual que en
  desarrollo.
- `apps/frontend/Dockerfile` + `apps/frontend/nginx.conf` — build de Vite
  servido por nginx, que reenvía `/api/*` al backend por la red privada
  de Railway (el frontend ya llama a rutas relativas, no hubo que tocar
  código).
- `.dockerignore` en la raíz.

## 1. Crea el proyecto en Railway

1. Entra a [railway.app](https://railway.app) y crea un proyecto nuevo
   ("Empty Project" o "Deploy from GitHub repo").
2. Conecta tu cuenta de GitHub y da acceso al repo `iguanaec/crm-iguana`.
3. En este proyecto vas a tener **3 servicios**: `backend`, `frontend` y
   `Postgres`.

## 2. Base de datos

1. Dentro del proyecto: **New → Database → Add PostgreSQL**.
2. Railway crea el servicio y una variable `DATABASE_URL` automática.
   No hay que tocar nada más aquí.

## 3. Servicio backend

1. **New → GitHub Repo** → selecciona `crm-iguana` y la rama de este
   despliegue (`claude/sweet-cannon-a5cfnc`, o la que definas como rama
   de pruebas).
2. Nómbralo `backend` (el `nginx.conf` del frontend asume ese nombre
   para la red interna; si usas otro nombre, ajusta
   `apps/frontend/nginx.conf` antes de construir la imagen del
   frontend).
3. En **Settings → Build**, deja el "Root Directory" en `/` (raíz del
   repo, no `apps/backend`: el backend necesita ver los workspaces
   `packages/types` y `packages/assistant`) y pon el **Dockerfile Path**
   en `apps/backend/Dockerfile`.
4. En **Variables**, añade:
   - `DATABASE_URL` → referencia a la variable del servicio Postgres
     (Railway te deja enlazarla con `${{Postgres.DATABASE_URL}}`).
   - `JWT_SECRET` → genera uno propio: `openssl rand -base64 32`.
   - `JWT_EXPIRES_IN` → `7d`.
   - `NODE_ENV` → `production`.
   - `PORT` → `5000` (fijo, para que el proxy interno del frontend lo
     encuentre en `backend.railway.internal:5000`).
   - `DEFAULT_TIMEZONE` → `America/Bogota` (o la que corresponda).
5. **No generes dominio público** para este servicio: solo el frontend
   necesita ser accesible desde internet; el backend se consume por red
   privada.
6. Despliega. El endpoint `/health` sirve para verificar que levantó.

## 4. Servicio frontend

1. **New → GitHub Repo** → mismo repo y rama.
2. Nómbralo `frontend`.
3. Root Directory en `/`, **Dockerfile Path** en
   `apps/frontend/Dockerfile`.
4. En **Settings → Networking**, genera un dominio público y fija el
   **target port en 8080** (el puerto que expone el `nginx.conf`).
5. Despliega.

## 5. Verifica

- Abre el dominio del frontend. Deberías ver el login de CRM Iguana con
  el estilo claro/verde de iguana-web.
- Si algo falla al llamar a la API, revisa los logs del servicio
  `frontend` (nginx) y del `backend`.

## Datos de ejemplo (opcional)

Para cargar datos de prueba, conéctate al servicio backend desde la CLI
de Railway y corre:

```bash
railway run -s backend npm run db:seed -w @crm/backend
```

## Siguientes pasos para producción real

Esta guía es intencionalmente mínima. Antes de usarlo con datos reales
de negocio faltaría: dominio propio, backups de la base de datos, un
segundo entorno de verdad para pruebas, límites de CORS más estrictos
que el `cors()` abierto actual, y logs/monitoreo.

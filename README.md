# CRM Iguana

CRM con asistente de priorización. Gestiona clientes, proyectos, pipelines, tareas y
objetivos; el asistente calcula qué sigue, avisa cuando algo vence y crea tareas a
partir de una frase escrita en español.

Sin servicios de pago: todo corre local sobre software libre.

## Requisitos

- Node.js 20 o superior
- PostgreSQL 16 (local o en Docker)

## Puesta en marcha

```bash
git clone https://github.com/iguanaec/crm-iguana.git
cd crm-iguana
npm install
cp .env.example .env
```

Abre `.env` y pon un `JWT_SECRET` propio:

```bash
openssl rand -base64 32
```

### Base de datos

Con Docker:

```bash
npm run db:up          # levanta PostgreSQL en el puerto 5432
```

O con un PostgreSQL ya instalado, crea el usuario y la base que espera `.env`:

```bash
sudo -u postgres psql -c "CREATE USER crm WITH PASSWORD 'crm_local_dev' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE crm_iguana OWNER crm;"
```

Luego aplica el esquema:

```bash
npm run db:migrate     # crea las tablas
npm run db:seed        # datos de ejemplo (opcional)
```

### Arrancar

```bash
npm run dev
```

- Interfaz: http://localhost:5173
- API: http://localhost:5000/api/v1

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Levanta API e interfaz juntas |
| `npm test` | Corre las pruebas de todos los paquetes |
| `npm run typecheck` | Revisa tipos en todo el monorepo |
| `npm run db:migrate` | Aplica migraciones pendientes |
| `npm run db:studio` | Explorador visual de la base de datos |

## Estructura

```
apps/
  backend/     API Express + Prisma
  frontend/    React + Vite + Tailwind
packages/
  assistant/   Priorización y lectura de lenguaje natural (lógica pura, sin red)
  types/       Tipos compartidos entre API e interfaz
```

El paquete `assistant` no habla con la base de datos ni con servicios externos: recibe
datos, devuelve resultados. Por eso se puede probar entero sin levantar nada.

## Cómo decide el asistente

El score de cada tarea (0 a 10) combina cuatro factores:

| Factor | Peso | Qué mide |
| --- | --- | --- |
| Urgencia | 40% | Cercanía de la fecha límite; una tarea vencida satura el factor |
| Dependencias | 30% | Cuántas tareas quedan bloqueadas esperando esta |
| Impacto | 20% | Si aporta a un objetivo, y si ese objetivo es crítico |
| Carga | 10% | Penaliza a quien ya acumula demasiadas tareas abiertas |

La prioridad manual (1 a 5) es tuya y el asistente nunca la sobrescribe: cuando su
score se aleja dos niveles o más de lo que fijaste, lo sugiere y tú decides. Una
diferencia de un solo nivel no se reporta, porque avisar de matices enseña a
ignorar los avisos.

Nunca recomienda empezar algo que espera por otra tarea, aunque tenga el puntaje
más alto.

## Crear tareas escribiendo

Pulsa `N` en cualquier pantalla y describe la tarea como la dirías en voz alta:

```
Llamar a Laura para revisar la propuesta el martes, urgente
Preparar informe de cierre en 3 horas
Lanzar sitio con: copy, diseño y pruebas
```

Reconoce fechas (`mañana`, `el viernes`, `en 3 días`, `fin de mes`, `15/10`),
prioridad (`urgente`, `cuando puedas`), esfuerzo (`en 2 horas`) y listas de
subtareas. Antes de guardar te muestra lo que entendió, para que lo corrijas si
se equivocó. Todo con reglas locales: no sale una sola petición a internet.

## Avisos

| Cuándo | Qué llega |
| --- | --- |
| A la hora que elijas (9:00 por defecto) | Resumen del día: por dónde empezar, qué venció, qué es para hoy |
| Dos días antes de un vencimiento | Un aviso por tarea, solo si importa por prioridad o puntaje |

Máximo tres al día, para que sigan significando algo.

Los avisos siempre quedan en la app. Si quieres recibirlos también en Discord o
Slack, ve a **Ajustes**, pega la dirección de un webhook entrante y usa *Enviar
prueba*. Solo se aceptan direcciones `https` de `discord.com` o
`hooks.slack.com`: el servidor es quien hace la petición, y aceptar cualquier
dirección lo convertiría en un puente hacia redes privadas.

Para verlos sin esperar la hora programada, usa *Revisar ahora* en Ajustes.

# Desplegar el mockup en Cloudflare Workers (desde GitHub)

Este mockup es HTML/CSS/JS estático (sin backend, sin base de datos). Se
despliega con la integración Git de Cloudflare Workers: cada push a la
rama conectada dispara un deploy automático, sin que tengas que correr
nada localmente.

## Pasos

1. Entra a [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers
   & Pages** → **Create** → pestaña **Import a repository** (o "Connect
   to Git" si ya tienes un Worker creado).
2. Conecta tu cuenta de GitHub y autoriza acceso al repo
   `iguanaec/crm-iguana` (o a toda tu organización `iguanaec`, como
   prefieras).
3. Selecciona el repo `crm-iguana` y la rama `claude/sweet-cannon-a5cfnc`
   (la rama de pruebas de este prototipo).
4. En **Root directory**, escribe `mockup` — así Cloudflare solo mira
   esta carpeta, no el resto del monorepo.
5. Cloudflare detecta automáticamente el `wrangler.toml` de esta carpeta
   (sirve los estáticos vía `[assets]`, sin build ni comandos extra). Deja
   los campos de build vacíos.
6. Dale a **Deploy**. En un par de minutos te da una URL tipo
   `https://crm-iguana-mockup.<tu-subdominio>.workers.dev`.
7. A partir de aquí, cualquier push a esa rama vuelve a desplegar solo.

## Qué NO incluye todavía

- Sin conexión a base de datos ni al backend real (`apps/backend`):
  todo el contenido es estático y de ejemplo.
- Sin autenticación real: es solo para mostrar/validar el diseño en
  celular.

Cuando se apruebe el diseño, el siguiente paso natural es conectar este
mockup (o el frontend real de `apps/frontend`) a la API desplegada en
Railway — ver `../DEPLOY.md` en la raíz del repo.

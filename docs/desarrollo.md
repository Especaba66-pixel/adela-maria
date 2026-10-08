# Cómo trabajar en el proyecto

## Requisitos

- Node.js 22 y pnpm 10 (`corepack enable`).
- PostgreSQL 16. Lo más cómodo: `docker compose up -d`, que crea las bases `adela_dev`, `adela_test` y `adela_restauracion`.
- Herramientas de PostgreSQL 16 (`psql`, `pg_dump`, `pg_restore`) para las copias.

## Primera vez

```bash
pnpm install
cp .env.example .env        # y cambia la contraseña y el PIN de la administradora
pnpm db:migrate             # crea las tablas
pnpm db:seed                # centro, primera administradora y tarifas
pnpm dev                    # http://localhost:3000
```

## Comprobaciones

| Orden | Qué comprueba |
| --- | --- |
| `pnpm typecheck` | Tipos de todo el proyecto |
| `pnpm test` | Reglas de negocio y reglas de la base de datos (usa `DATABASE_URL_TEST`, que se vacía) |
| `pnpm test:e2e` | Recorridos completos en el navegador, con pantalla de TPV de 1366×768 |
| `infra/copias/copia.sh` y `infra/copias/probar-restauracion.sh` | Copia de seguridad y restauración comprobada |

GitHub ejecuta todo lo anterior en cada cambio (`.github/workflows/ci.yml`). Nada llega al centro sin pasar por ahí.

## Cambiar la base de datos

1. Edita `packages/db/src/esquema.ts`.
2. `pnpm db:generate --name que-cambia` crea la migración en `packages/db/migraciones/`.
3. Revisa el SQL generado y súbelo junto con el cambio. Las reglas que no se pueden expresar en el esquema
   (disparadores) van en una migración propia: `pnpm --filter @adela/db exec drizzle-kit generate --custom --name ...`.

Nunca se edita una migración ya aplicada en producción: se añade otra.

## Carpetas

```text
apps/web/            App web (Next.js): pantallas en app/, lógica de servidor en server/
packages/dominio/    Reglas puras: permisos, credenciales, sesión, dinero (con pruebas)
packages/db/         Esquema, migraciones, datos iniciales (tarifas en src/datos/tarifas.ts)
packages/ui/         Colores, tipografía y componentes táctiles
tests/               Recorridos completos con Playwright
infra/copias/        Copias de seguridad y prueba de restauración
docs/                Plan maestro, decisiones y cierre de cada fase
```

El agente del TPV (`apps/agente-tpv`) y las integraciones (`packages/integraciones`) llegan en las fases 2, 5 y 6.

# Architecture

## Stack (проверено от `package.json` / конфигурации)

- **Frontend:** React 19, TypeScript 5.9, Tailwind 4, shadcn/Radix UI (`client/src/components/ui`), Wouter routing (с patch в `patches/`), TanStack Query + tRPC client.
- **SSR:** Vite 7; `client/src/entry-server.tsx` + `client/src/ssr/prefetch.ts`; отделен build `vite.config.ssr.ts` → `dist/server-ssr`.
- **Backend:** Node 22, Express 4, tRPC 11 (`/api/trpc`), superjson, zod 4.
- **Data:** Drizzle ORM 0.45 + `mysql2`; schema в `drizzle/schema.ts`.
- **Package manager:** pnpm 10.4.1 (pinned).

## Директории

| Път | Роля |
|---|---|
| `client/src/pages` | Страници (Home, Category, Product, Checkout, Admin*, Customer*, статични страници) |
| `client/src/components/Storefront.tsx` | Общ layout на магазина (header, footer, навигация) |
| `client/src/lib/storeData.ts` | Статични базови категории + seed данни (виж DATABASE.md) |
| `client/public/media` | ~8 460 локални медийни файла (103 MB), обслужвани като `/media/*` и `/manus-storage/*` |
| `server/_core` | Manus framework: Express app, OAuth, SDK, Vite/SSR, security headers, storage proxy, LLM, notifications |
| `server/routers.ts` | Всички tRPC procedures (`catalogue`, `contact`, `customer`, `admin`, `access`, `staff`, `system`) |
| `server/catalogueService.ts` | Основна бизнес логика на каталога, поръчки, админ операции (~1 650 реда) |
| `server/*.test.ts` | 85 vitest файла — предимно source-text/regression тестове, малко DB тестове |
| `shared/` | Общи типове, валидация (`productValidation`, `categoryValidation`), права (`permissions.ts`) |
| `drizzle/` | Schema, relations, 35 migrations, `access_roles_seed.sql` |
| `scripts/` | Еднократни migration/audit/export скриптове (OpenCart, медии, portable export) |
| `netlify/functions/server.ts` | Serverless обвивка на същия Express app |

## Request flow

```
Browser → Express (server/_core/index.ts)
  ├─ /manus-storage/* → локална папка (LOCAL_MEDIA_ROOT или client/public/media) или Forge signed redirect
  ├─ /api/oauth/callback → Manus OAuth (админи)
  ├─ Google customer auth routes (ако са конфигурирани)
  ├─ /api/trpc → appRouter (server/routers.ts) → catalogueService → MySQL
  └─ всичко друго → dev: Vite middleware + SSR / prod: serveStatic + SSR, robots.txt, sitemap.xml
```

## Auth и права

- **Админи/персонал:** Manus OAuth → `users` (openId) + `access_roles`. Procedures: `permissionProcedure`, `anyPermissionProcedure`, `administratorOnlyProcedure` (`server/permissionProcedures.ts`).
- **Клиенти:** отделна cookie сесия (`JOAN_CUSTOMER_SESSION_SECRET`), scrypt хешове в `customer_credentials`; same-origin проверка на мутациите.

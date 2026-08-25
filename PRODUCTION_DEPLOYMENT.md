# Joan.bg — Production Deployment Guide извън Manus

**Статус на документа:** технически точен към последния проверен production snapshot. Той описва как приложението се премества към собствен сървър, без промяна на schema-та, product ID, SKU, цени или product data. Не изпълнявайте DNS cutover, докато не завършите `DATABASE_MIGRATION.md` и `DISASTER_RECOVERY.md`.

> **Критично:** текущият SuperPro shared server няма инсталиран Node.js runtime. Проектът **не може** да бъде качен само в `public_html`. Нужен е Node 22+ сървър, reverse proxy и MySQL 8. Стандартен PHP/OpenCart hosting не е съвместим.

## 1. Текуща архитектура

```mermaid
flowchart LR
  Browser[Browser] --> Nginx[Nginx / HTTPS reverse proxy]
  Nginx --> App[Node.js 22 / Express SSR]
  App --> API[tRPC: /api/trpc]
  App --> DB[(MySQL-compatible database)]
  App --> Media[/manus-storage or LOCAL_MEDIA_ROOT]
  App --> SSR[React SSR + Vite build]
```

| Област | Текуща технология | Runtime роля | Self-hosted заместител |
|---|---|---|---|
| Frontend | React **19.2.1**, TypeScript **5.9.3**, Tailwind 4, Wouter | Public UI, admin UI, hydration | Същият build |
| SSR/build | Vite **7.1.7**, esbuild **0.25.0** | SSR HTML, client assets, server bundle | Node 22.12+ build environment |
| Backend | Node.js, Express **4.22.1**, tRPC **11.6.0** | `/api/trpc`, SSR, sitemap, redirects | Persistent Node process зад Nginx |
| Data | MySQL-compatible managed database; Drizzle ORM **0.45.2**, `mysql2` | Catalogue, prices, customer/order records | MySQL **8.0** target database |
| Media | Managed object storage behind `/manus-storage/<key>` and signed redirect | Product images, galleries, brochure PDF/pages, icons | Local `/srv/joan/media` or company object storage |
| Auth | Manus OAuth for administrator identities; app-owned scrypt customer credentials | Admin authorization and customer sessions | Separate local admin-auth migration before production cutover |
| Package manager | pnpm **10.4.1** (pinned in `package.json`) | Deterministic dependency install | Same version/corepack |

The current production database is **MySQL-compatible TiDB**, accessed only through `DATABASE_URL` and Drizzle’s MySQL driver. The physical cloud provider and region are not exposed by application source or the project configuration; they must not be invented in an external deployment document.

## 2. Repository, entrypoints and exact commands

| Purpose | File / command |
|---|---|
| Server entrypoint | `server/_core/index.ts` |
| SSR entrypoint | `client/src/entry-server.tsx` |
| Production static/SSR handler | `server/_core/vite.ts` |
| Schema source | `drizzle/schema.ts` |
| Exact production DDL reference | `docs/DATABASE_SCHEMA_REFERENCE.sql` |
| tRPC router | `server/routers.ts` |
| Production build output | `dist/index.js`, `dist/public/`, `dist/server-ssr/` |
| Install | `corepack enable && pnpm install --frozen-lockfile` |
| Type check | `pnpm check` |
| Tests | `pnpm test` |
| Build | `pnpm build` |
| Start | `NODE_ENV=production PORT=3000 pnpm start` |
| Drizzle migration generation/application | `pnpm db:push` — **only** for approved future schema changes, never as a migration shortcut |

The application selects a free port beginning at `PORT` (default `3000`) and must be kept behind a reverse proxy. It is a combined frontend/backend deployment: public SSR and tRPC use the same origin, so splitting them requires intentional CORS/API and SSR changes; do not split them during the first migration.

## 3. Required self-hosted server baseline

| Requirement | Minimum deployment condition | Reason |
|---|---|---|
| OS | Supported Linux server with a company-controlled administrator | Process, patch and backup control |
| Node.js | **22.12+**; project was built with Node 22.13 | Vite 7 requires Node 20.19+ or 22.12+ [1] |
| Database | MySQL 8.0, UTF-8 (`utf8mb4`), dedicated DB user | Drizzle schema uses `mysqlTable`, MySQL enums, indexes and foreign keys |
| Reverse proxy | Nginx/Caddy with HTTPS and HTTP→HTTPS redirect | TLS termination, canonical redirect and buffered static media |
| Process manager | `systemd`, PM2 or equivalent persistent supervisor | Auto-restart and logs; cPanel `public_html` is insufficient |
| Storage | At least the measured media export plus build, database and backup headroom | Current portable media snapshot is 8,329 files / 1,095,949,081 bytes before additional retention |
| SSH/SFTP | Named deployment user; no shared root credentials | Safe deployments and auditability |
| Backups | Tested database and media restore paths | A backup that cannot restore is not a migration control |

No validated load test exists for the stated high-volume use case. CPU, RAM, DB IOPS and bandwidth must be sized from measured peak traffic and load testing; this document deliberately does not promise an unverified capacity number.

## 4. Environment inventory — names only, never commit values

Create `/etc/joan/production.env` with owner-only access (`chmod 600`) or an equivalent secret manager. Never place it inside the repository or web root.

| Variable | Purpose now | Required outside Manus | Migration action |
|---|---|---:|---|
| `NODE_ENV` | Enables production headers and production serving | Yes | Set `production` |
| `PORT` | Express listen port | Yes | Set internal port, e.g. `3000` |
| `DATABASE_URL` | MySQL/TiDB connection used by Drizzle and raw export scripts | Yes | Replace with target MySQL URL |
| `JWT_SECRET` | Customer session signing and current app cookie secret | Yes | Generate a new high-entropy secret; do not reuse current value |
| `CANONICAL_ORIGIN` | SSR canonical, sitemap and Open Graph origin | Yes | Set `https://joan.bg` after DNS cutover |
| `SITE_NAME` | SSR default site name | Recommended | Set `ЖОАН` |
| `LOCAL_MEDIA_ROOT` | Local `/manus-storage/<key>` serving mode | Yes for local files | Set absolute media path, e.g. `/srv/joan/media` |
| `VITE_ANALYTICS_ENDPOINT` | Analytics script source in `client/index.html` | Optional | Replace/remove with approved analytics provider |
| `VITE_ANALYTICS_WEBSITE_ID` | Analytics site ID | Optional | Replace/remove with approved provider value |
| `VITE_APP_ID` | Manus OAuth app identity | No | Replace only after a new auth design; not usable standalone |
| `OAUTH_SERVER_URL` | Manus OAuth server | No | Remove/replace with local auth provider |
| `VITE_OAUTH_PORTAL_URL` | Browser redirect to Manus OAuth | No | Remove/replace with local auth UI/provider |
| `OWNER_OPEN_ID`, `OWNER_NAME` | Manus administrator bootstrap identity | No | Replace with local administrator account model |
| `BUILT_IN_FORGE_API_URL` | Managed Forge APIs | No for portable media mode | Remove dependency after local storage/auth replacement |
| `BUILT_IN_FORGE_API_KEY` | Managed Forge server credential | No | Never copy to target; replace storage/integration implementations |
| `VITE_FRONTEND_FORGE_API_URL` | Frontend Forge endpoint used by Map component | Conditional | Replace Map integration or remove the feature |
| `VITE_FRONTEND_FORGE_API_KEY` | Frontend Forge key used by Map component | Conditional | Replace with approved own map key/integration |

`PORTABLE_EXPORT_DIR`, `PORTABLE_SOURCE_ORIGIN`, `PORTABLE_MEDIA_CONCURRENCY`, `SOURCE_DATABASE_URL`, `TARGET_DATABASE_URL`, `MIGRATION_VALIDATION_DIR` and `SCHEMA_REFERENCE_PATH` are **one-off maintenance/export variables**, not production application secrets.

## 5. Manus dependency audit and replacement work

| Dependency | Current role | Is it required for current production? | Self-hosted migration requirement |
|---|---|---:|---|
| Managed database | Current catalogue/customer/order data | Yes until data restore | Restore SQL into company MySQL 8 and set a new `DATABASE_URL` |
| `/manus-storage` / Forge storage | Source media uploads and signed redirects | Yes in current deployment | Use `LOCAL_MEDIA_ROOT` with exported media, then replace admin upload storage adapter for permanent company storage |
| CloudFront media redirect | Managed delivery of source storage | Yes in current deployment | Remove CloudFront from CSP after local media/own CDN is verified |
| Manus OAuth | Admin login (`users.openId`) | Yes for current admin login | Implement local admin account/session flow; current OAuth identity cannot be reused as a local password |
| Forge Map integration | Optional `Map.tsx` map API proxy | Only if map component is used | Configure a company-owned map provider/API key or remove map feature |
| Manus analytics | Analytics script endpoint | Optional | Replace or remove after consent review |
| Heartbeat SDK | Scheduler framework files exist | **No active business job** | No job migration required; no code calls `createHeartbeatJob` |
| WebDev deployment/checkpoints | Current publishing and rollback | Yes only while hosted here | Replace with GitHub CI/CD, server releases and independent backups |

## 6. Data model at a glance

The authoritative TypeScript schema is `drizzle/schema.ts`. The exact schema-only SQL snapshot generated from the current production database is `docs/DATABASE_SCHEMA_REFERENCE.sql`; it contains **15 base tables**, DDL, indexes and foreign keys without customer/product rows.

| Table | Business content | Primary relations / critical fields |
|---|---|---|
| `catalogue_products` | Products, names, SKU, price EUR, old price, discount label, availability, stock, image, gallery, features, SEO/slugs | `categoryId → catalogue_categories.id`; unique `legacyProductId`, `slug`, `legacyPublicSlug` |
| `catalogue_categories` | Category and nested category metadata | `legacyParentCategoryId` stores source hierarchy; nested display tree is in `subcategoriesJson` |
| `catalogue_product_category_links` | Multiple category memberships | `productId → catalogue_products`, `categoryId → catalogue_categories` |
| `catalogue_manufacturers` | Brands/manufacturers | `nameEn`/metadata are optional; no product FK is stored in this schema |
| `catalogue_brochures` | Brochure title, source PDF URL/key, page URLs | URLs reference managed/local media |
| `order_requests` | Current non-payment checkout requests | Optional `productId → catalogue_products` |
| `contact_enquiries` | Contact form enquiries | Standalone operational record |
| `customer_profiles` | Migrated customer identity/profile data | Unique `legacyCustomerId` and email |
| `customer_addresses` | Customer addresses | `customerId → customer_profiles` |
| `customer_credentials` | New customer password hash/session version | One-to-one with profile; scrypt-v1 password hashes only |
| `customer_activation_tokens` | SHA-256 hashed activation/reset tokens | `customerId → customer_profiles` |
| `legacy_customer_orders` | Historical OpenCart order headers | Optional `customerId → customer_profiles` |
| `legacy_customer_order_lines` | Historical order lines | `legacyOrderRecordId → legacy_customer_orders` |
| `users` | Current Manus-authenticated user identities/roles | Current admin identity is OAuth-linked, not local password-based |
| `admin_activities` | Admin audit events | `adminUserId → users` |

There is **no dedicated product-variant table**, **no dedicated settings table**, **no soft-delete column**, and **no UUID primary-key model**. All primary keys are auto-increment integer IDs. Timestamps are MySQL `timestamp` columns, generally `createdAt` and `updatedAt`; `updatedAt` uses `ON UPDATE` where declared. Logical visibility is modelled by `isActive`, not soft deletion.

## 7. Current production data inventory

The following counts are from a read-only production query during this documentation audit. They are a snapshot; repeat the validation queries at actual cutover.

| Entity | Exact snapshot count | Notes |
|---|---:|---|
| Products | **11,020** total; **7,011** active | 11,020 priced; 82 old-price/discount-labelled records |
| Availability | 5,829 in stock; 43 on request; 5,148 out of stock | Stored in `catalogue_products.availability` and `stockQuantity` |
| Categories | 478 total; 11 active; 463 with a legacy parent | Hierarchy also represented in `subcategoriesJson` |
| Manufacturers | 195 total/active | `catalogue_manufacturers` |
| Product-category links | 42,275 | Multiple membership rows |
| Brochures | 4 total; 1 active; 2 archived | PDF/page media URLs stored in DB |
| Customer profiles | 274 | Customer data is personal data and needs restricted handling |
| Customer addresses | 275 | 274 marked default |
| Customer credentials | 274 | 0 password hashes currently set in this snapshot |
| Historical orders / lines | 881 / 1,038 | Historical imported source records |
| Current order requests | 1 | Non-payment request flow |
| Contact enquiries | 0 | At audit time |
| Admin users / activities | 2 / 41 | One `admin` role in snapshot |
| Portable media export | 8,329 unique files; 1,095,949,081 bytes | Includes product/category/brochure and source-code media references |

The product data is not fed by a live ERP, OpenCart API, webhook, cron or scheduled synchronization. Product creation, update, price/stock adjustment and import are currently tRPC/admin actions. Zeron integration is not implemented. Search is custom database-backed catalogue filtering/sorting; there is no Elasticsearch, Algolia, Meilisearch or standalone search index to migrate.

## 8. Production deployment sequence

1. Provision a private staging hostname such as `staging.joan.bg`; do **not** change `joan.bg` yet.
2. Create target MySQL 8 database/user and restore the verified SQL snapshot from `DATABASE_MIGRATION.md`.
3. Place `media/` outside the repository, e.g. `/srv/joan/media`; set `LOCAL_MEDIA_ROOT=/srv/joan/media`.
4. Install source code with `pnpm install --frozen-lockfile`, run `pnpm check`, `pnpm test`, then `pnpm build`.
5. Configure a systemd service using a protected environment file; run Node on loopback only.
6. Configure Nginx for HTTPS, proxy `/` to `127.0.0.1:3000`, and serve no writable upload directory from the repository.
7. Complete SQL/media/SEO/admin acceptance tests on staging.
8. Freeze new write operations, take the final database and media snapshot, run source-vs-target validation, and only then perform controlled DNS cutover.

Example systemd unit (adapt paths/user, do not copy secrets into the unit):

```ini
[Unit]
Description=Joan.bg Node SSR
After=network.target mysql.service

[Service]
Type=simple
User=joan
WorkingDirectory=/srv/joan/app
EnvironmentFile=/etc/joan/production.env
ExecStart=/usr/bin/node /srv/joan/app/dist/index.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Example Nginx canonical domain policy (replace certificate paths and server IP/domain only after validation):

```nginx
server {
  listen 80;
  server_name joan.bg www.joan.bg;
  return 301 https://joan.bg$request_uri;
}

server {
  listen 443 ssl http2;
  server_name www.joan.bg;
  return 301 https://joan.bg$request_uri;
}

server {
  listen 443 ssl http2;
  server_name joan.bg;
  # ssl_certificate and ssl_certificate_key supplied by the chosen TLS process
  client_max_body_size 50m;
  location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; }
}
```

## 9. Domain, DNS, TLS and SEO controls

No exact A/AAAA value can be supplied before a target server is provisioned. Do not guess one. The destination host must provide the target IPv4/IPv6 values.

| DNS / HTTP item | Required control |
|---|---|
| `A joan.bg` | Target server IPv4, supplied after provisioning |
| `AAAA joan.bg` | Only if a verified IPv6 endpoint is configured |
| `www` | CNAME to `joan.bg` or matching A/AAAA; then HTTP 301 to canonical `https://joan.bg` |
| MX/TXT email records | Preserve unchanged unless the email administrator explicitly changes them |
| TLS | Valid certificate for both `joan.bg` and `www.joan.bg`; HTTP → HTTPS redirect |
| Canonical | Set `CANONICAL_ORIGIN=https://joan.bg` |
| Sitemap/robots | Served dynamically at `/sitemap.xml` and `/robots.txt`; test after restore |
| Product URLs | Preserve `catalogue_products.slug`, `legacyPublicSlug`, legacy 301 behavior and Latin URL validation |

The SSR layer emits title, description, canonical, Open Graph/Twitter tags, robots and sitemap. Migration must preserve database slug/SEO columns and test all old public product URLs. Do not alter URLs without a documented 301 mapping.

## 10. CI/CD after leaving Manus

GitHub is connected, but an independent self-hosted deployment workflow is **not configured yet**. A safe workflow is: GitHub push → CI (`pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, `pnpm build`) → immutable release artifact → manual approval → deploy to staging → health/SEO smoke checks → manual production promotion → retained previous release for rollback. The deployment key, server user, `.env`, database dump and media archive must never be stored in GitHub Actions logs or repository secrets visible to unapproved users.

## 11. SuperHosting compatibility decision

The confirmed current SuperPro server has **no Node.js installed**. It is therefore incompatible with the existing Node/Express SSR application. A compatible SuperHosting target must provide a persistent Node 22.12+ process, MySQL 8, SSH/SFTP, reverse proxy or passenger equivalent, TLS, environment variables outside web root, persistent media storage, and a tested backup/restore path. If that cannot be supplied, use a different company-controlled Node-capable host; do not deploy this application to `public_html` as static PHP files.

## References

[1]: https://vite.dev/guide/ "Vite Guide — Node.js version compatibility"

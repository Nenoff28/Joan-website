# Database

_Без secrets. Подробни runbook-и: `DATABASE_MIGRATION.md`, `DISASTER_RECOVERY.md`._

## Източник на истината

- **Schema:** `drizzle/schema.ts` — 30 таблици (каталог, категории, производители, EN преводи, промоции, AI съдържание/опашка, поръчки/заявки с история, запитвания, брошури, клиенти/адреси/credentials/токени, стари OpenCart поръчки, users, роли, admin activity).
- **Production:** MySQL-съвместим **TiDB**, управляван от Manus. Не е в repository-то и не е достъпен локално.
- `docs/DATABASE_SCHEMA_REFERENCE.sql` е **остарял** (15 таблици) спрямо `schema.ts` (30).

## Важно за безопасността

- `server/catalogueService.ts` → `ensureCatalogueSeeded()` при първа публична заявка **записва** в базата: ако `catalogue_categories` е празна, вкарва базови категории и примерни продукти от `client/src/lib/storeData.ts`; ако не е празна — попълва празни `subcategoriesJson`. Никога не насочвайте dev сървър към production база.
- `admin.databaseImport` заменя данни в базата — само за администратор.

## Локална база (isolated)

| | |
|---|---|
| Сървър | MySQL 8.4.9 (winget `Oracle.MySQL`), стартиран като процес, не като Windows service |
| Конфигурация | `%USERPROFILE%\joan-mysql\my.ini` (bind `127.0.0.1:3306`, utf8mb4) |
| Данни | `%USERPROFILE%\joan-mysql\data` (извън проекта) |
| База / потребител | `joan_local` / `joan_local` (паролата е само в `.env`, който е в `.gitignore`) |
| Съдържание | Schema от `drizzle-kit migrate` (35 миграции) + **production snapshot `joan-database-2026-11-17.sql`**, импортиран на 2026-11-17: 11 024 продукта (5 850 активни), 480 категории, 195 производителя (110 с лого), 276 клиентски профила, 881 стари поръчки. ⚠ Съдържа **лични данни на клиенти** — само локално; не се commit-ва и не се копира в проекта. Таблиците са с колация `utf8mb4_bin` като в production. |
| Backup преди импорта | `%USERPROFILE%\joan-mysql\backups\joan_local-before-import-2026-11-17.sql` (предишната тестова база с 55 примерни продукта) |

### Миграции

Поправени на 2026-11-17 — всички 35 миграции се прилагат върху чист MySQL 8, а `drizzle-kit push` и `generate` са в синхрон с тях:

| Файл | Поправка |
|---|---|
| `drizzle/0006_worthless_maelstrom.sql` | премахнат дублиран `ADD legacySeoKeywordBg` |
| `drizzle/0015_brainy_ulik.sql` | премахнат финален `--> statement-breakpoint` (празна заявка) |
| `drizzle/0029_dark_mastermind.sql` | добавен `--> statement-breakpoint` между `CREATE TABLE` и `INSERT` |
| `drizzle/schema.ts` + `drizzle/meta/0034_snapshot.json` | 4 FK с изрични имена, както са в миграциите и в production: `cpc_link_product_fk`, `cpc_link_category_fk`, `lc_order_customer_fk`, `lc_order_line_order_fk` |

**Защо това е безопасно за production:** drizzle migrator сравнява само `created_at` от `meta/_journal.json` с последния ред в `__drizzle_migrations`; hash-ът на файла не се проверява. Вече приложените миграции не се изпълняват повторно. Промяната в `schema.ts` засяга само имената на ограниченията в DDL — runtime заявките не ги ползват, а `drizzle-kit generate` връща `No schema changes`.

**Правило за нови FK:** автоматичното име `<table>_<col>_<refTable>_<refCol>_fk` не трябва да надвишава 64 символа. Ако го надвишава, задайте име с `foreignKey({ name, columns, foreignColumns })`.

Проверено: migrations, `push` и `schema.ts` дават идентична схема (477 реда: колони, типове, defaults, индекси, FK с имената им); повторен `migrate` не прави нищо.

### Пресъздаване на локалната база (root без парола, само localhost)

```bash
MYSQL="/c/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe"
"$MYSQL" -uroot -h127.0.0.1 -e "DROP DATABASE joan_local; CREATE DATABASE joan_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
corepack pnpm exec drizzle-kit migrate   # чете DATABASE_URL от .env
```

`drizzle/access_roles_seed.sql` не е нужен след миграциите — дублира `0015`.

### Зареждане на реален snapshot

Нужен е `joan-database-<timestamp>.sql.gz` от `scripts/export-portable-database.mjs` (съдържа лични данни — пази се криптиран, не влиза в Git). Възстановява се в `joan_local` по процедурата в `DATABASE_MIGRATION.md` §3.2.

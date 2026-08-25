# Joan.bg — Database Migration, Backup and Validation Runbook

**Objective:** move the current MySQL-compatible catalogue database to a company-controlled MySQL 8 target without changing schema, products, IDs, SKU, prices, stock, category membership, slugs or historical records.

> **Do not run `pnpm db:push` against the new production target as a shortcut.** Restore the tested snapshot first. Drizzle migrations are only for future reviewed schema changes after migration.

## 1. Source and target

| Item | Source | Target |
|---|---|---|
| Database technology | MySQL-compatible TiDB accessed with `mysql2` and Drizzle ORM | MySQL 8.0 with `utf8mb4` recommended |
| ORM role | Schema declaration, typed queries and migrations; it is not the physical database | Same application role after a valid restore |
| Schema source | `drizzle/schema.ts` | Must match `docs/DATABASE_SCHEMA_REFERENCE.sql` |
| Full logical data export | `scripts/export-portable-database.mjs` | Compressed SQL snapshot restored by MySQL client |
| Media export | `scripts/generate-portable-media-manifest.mjs` + `scripts/download-portable-media.mjs` | Company storage/local media directory |

The exact current DDL is in `docs/DATABASE_SCHEMA_REFERENCE.sql`. It includes all 15 current base tables, auto-increment IDs, unique constraints, foreign keys and indexes without exporting data.

## 2. Current snapshot controls

The verified export tooling writes an SQL gzip file and a sidecar JSON manifest with byte length, SHA-256, row count and generation time. It does not print a connection URL or password. The current verified snapshot contained **56,758 rows** and was generated with a repeatable-read transaction snapshot without table locks, because generic `mysqldump`/`mysqlpump` lock/savepoint options are not compatible with the managed TiDB source.

```bash
cd /path/to/joan-bg-redesign
PORTABLE_EXPORT_DIR=/secure/company/joan-export \
node scripts/export-portable-database.mjs
```

The command creates:

```text
/secure/company/joan-export/database/joan-database-<timestamp>.sql.gz
/secure/company/joan-export/database/joan-database-<timestamp>.sql.gz.manifest.json
```

Store both artifacts in an access-controlled, encrypted company location. The SQL snapshot can contain customer profiles, addresses, order history, contact information and security hashes. It must not be committed to Git or placed in a public web directory.

## 3. Full database backup validation

### 3.1 Verify the archive before restore

```bash
sha256sum joan-database-<timestamp>.sql.gz
cat joan-database-<timestamp>.sql.gz.manifest.json
gzip -t joan-database-<timestamp>.sql.gz
```

The SHA-256 value must equal the `sha256` in the manifest. `gzip -t` must exit with status `0`.

### 3.2 Restore to an isolated test database

```bash
mysql --host=<target-host> --port=3306 --user=<migration-user> -p \
  -e "CREATE DATABASE joan_restore_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

gunzip -c joan-database-<timestamp>.sql.gz | \
  mysql --host=<target-host> --port=3306 --user=<migration-user> -p joan_restore_test
```

Do not use `--force`; a restore error must stop the procedure and be investigated.

### 3.3 Validate schema and data in the restored database

```sql
USE joan_restore_test;
SHOW TABLES;
SELECT COUNT(*) AS products FROM catalogue_products;
SELECT COUNT(*) AS active_products FROM catalogue_products WHERE isActive = 1;
SELECT COUNT(*) AS categories FROM catalogue_categories;
SELECT COUNT(*) AS child_categories FROM catalogue_categories WHERE legacyParentCategoryId IS NOT NULL;
SELECT COUNT(*) AS manufacturers FROM catalogue_manufacturers;
SELECT COUNT(*) AS product_category_links FROM catalogue_product_category_links;
SELECT COUNT(*) AS promoted_products FROM catalogue_products WHERE oldPriceEur IS NOT NULL OR discountLabel IS NOT NULL;
SELECT availability, COUNT(*) FROM catalogue_products GROUP BY availability ORDER BY availability;
SELECT COUNT(*) AS duplicate_slug_groups FROM (SELECT slug FROM catalogue_products GROUP BY slug HAVING COUNT(*) > 1) x;
SELECT COUNT(*) AS duplicate_sku_groups FROM (SELECT sku FROM catalogue_products WHERE sku IS NOT NULL GROUP BY sku HAVING COUNT(*) > 1) x;
```

At the current documented source snapshot, expected high-level values are 11,020 products, 7,011 active products, 478 categories, 195 manufacturers and 42,275 product/category link rows. Re-run the source query immediately before cutover; do not rely on old values after new catalogue changes.

### 3.4 Verify relationships and foreign keys

```sql
SELECT COUNT(*) AS products_without_category
FROM catalogue_products p
LEFT JOIN catalogue_categories c ON c.id = p.categoryId
WHERE c.id IS NULL;

SELECT COUNT(*) AS links_without_product
FROM catalogue_product_category_links l
LEFT JOIN catalogue_products p ON p.id = l.productId
WHERE p.id IS NULL;

SELECT COUNT(*) AS links_without_category
FROM catalogue_product_category_links l
LEFT JOIN catalogue_categories c ON c.id = l.categoryId
WHERE c.id IS NULL;

SELECT COUNT(*) AS addresses_without_customer
FROM customer_addresses a
LEFT JOIN customer_profiles c ON c.id = a.customerId
WHERE c.id IS NULL;

SELECT COUNT(*) AS order_lines_without_order
FROM legacy_customer_order_lines l
LEFT JOIN legacy_customer_orders o ON o.id = l.legacyOrderRecordId
WHERE o.id IS NULL;
```

All five values must be `0`. Also run `SHOW CREATE TABLE catalogue_products;` and compare it to the reference schema file.

## 4. Full source-versus-target comparison

The repository contains `scripts/verify-database-migration.mjs`. It is read-only: it connects to a source and target database, compares table membership, columns, normalized DDL, row counts and canonical SHA-256 hashes of ordered rows. It writes a JSON report and exits non-zero on any mismatch.

```bash
SOURCE_DATABASE_URL='mysql://<source-user>:<password>@<source-host>:3306/<source-db>' \
TARGET_DATABASE_URL='mysql://<target-user>:<password>@<target-host>:3306/joan_restore_test' \
MIGRATION_VALIDATION_DIR=/secure/company/joan-validation \
node scripts/verify-database-migration.mjs

cat /secure/company/joan-validation/database-migration-validation.json
```

Do not put either URL in shell history on a shared machine. Use protected environment files or a secret manager. A passed report is required before staging or production cutover.

## 5. Media migration procedure

Media bytes are not stored in database columns. Database fields store paths/URLs:

| Table/field | Content |
|---|---|
| `catalogue_products.imageUrl` | Primary product image path |
| `catalogue_products.galleryJson` | Product gallery path array |
| `catalogue_categories.imageUrl` | Category image path |
| `catalogue_manufacturers.imageUrl` | Manufacturer image path if present |
| `catalogue_brochures.sourcePdfUrl` and `pageUrlsJson` | Brochure PDF and page images |

Create and download the manifest before cutover:

```bash
PORTABLE_EXPORT_DIR=/secure/company/joan-export \
node scripts/generate-portable-media-manifest.mjs

PORTABLE_EXPORT_DIR=/secure/company/joan-export \
PORTABLE_MEDIA_CONCURRENCY=8 \
node scripts/download-portable-media.mjs
```

Verify `manifests/media-download-report.json`: `failed` must be `0`; compare `itemCount` with downloaded/skipped files and retain the SHA-256 report. Then place `media/` on the target outside the application repository and set `LOCAL_MEDIA_ROOT` to that absolute path. Existing `/manus-storage/<key>` paths resolve locally in this mode, so database URL values do not need bulk rewriting during the first self-hosted release.

## 6. Zero-data-loss migration sequence

The safe sequence is correct, with one addition: because there is no current change-data-capture or dual-write pipeline, a **write freeze** is required for a true final snapshot.

```text
Current production
  → full database + media snapshot
  → isolated restore
  → source-vs-target validator
  → staging application test
  → freeze writes (orders/contact/admin changes)
  → final complete snapshot + media delta validation
  → final target restore/validation
  → DNS cutover
  → monitored acceptance
```

If the current site remains writable while the final snapshot is taken, new order requests, contact enquiries, product edits or customer changes can be missing from the new target. Do not label that process “zero data loss.”

## 7. Production restore and cutover acceptance

1. Create an empty target production database with `utf8mb4`.
2. Restore the final `sql.gz` snapshot.
3. Run the full source-versus-target validator.
4. Restore media, verify manifest and make a sample of product/gallery/brochure URLs return HTTP `200`.
5. Build the source on the target and test `robots.txt`, `sitemap.xml`, canonical URLs, product pages, category pages, search/filtering, order request, contact form and admin access plan.
6. Preserve old website and DNS values until post-cutover acceptance is signed off.

## 8. Future daily backup command on target MySQL 8

After migration to company MySQL 8, a daily logical backup can use standard MySQL tooling because the target is not TiDB:

```bash
mysqldump --single-transaction --quick --routines --triggers --events \
  --default-character-set=utf8mb4 \
  --host=127.0.0.1 --port=3306 --user=joan_backup -p joan_production \
  | gzip -9 > /srv/joan-backups/db/joan-$(date -u +%F-%H%M%S).sql.gz
```

This command requires a backup user with only the required read/metadata privileges and must be paired with an off-host copy and regular restore test. See `DISASTER_RECOVERY.md`.

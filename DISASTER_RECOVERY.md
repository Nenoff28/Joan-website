# Joan.bg — Disaster Recovery and Rollback Runbook

**Purpose:** preserve a recoverable production service during self-hosted migration and operation. This is an operational procedure, not an SLA. RPO/RTO must be approved by the business owner after the production host, support contract and measured restore time are known.

## 1. Recovery assets that must exist before cutover

| Asset | Minimum content | Verification |
|---|---|---|
| Source release | Tagged Git commit and immutable build/release artifact | `pnpm check`, `pnpm test`, `pnpm build` passed |
| Database backup | Final compressed SQL snapshot + SHA-256 manifest | `gzip -t`, checksum and restore to isolated DB |
| Media backup | Full `media/` folder + `media-manifest.json` + download SHA-256 report | File count, hash/sample read and missing-file count `0` |
| Environment inventory | Names and secure target values in secret manager | No secrets in Git, ZIP or web root |
| Previous environment | Old site URL/DNS records and a confirmed owner | Browser health check before cutover |
| DNS rollback record | Previous A/AAAA/CNAME values and registrar credentials | Two-person review before cutover |
| Runbook | Named incident owner, technical operator and business approver | Contact list tested |

## 2. Backup policy after self-hosted migration

| Frequency | Artifact | Destination | Mandatory check |
|---|---|---|---|
| Per release | Git tag/release artifact, `production.env` inventory excluding values | Repository + secure secret manager | Deploy can be rebuilt from clean host |
| Daily | Logical MySQL backup | Encrypted local target + independent protected copy | `gzip -t`, SHA-256 and weekly restore |
| Daily / after media change | Media manifest and delta copy | Persistent media storage + independent protected copy | Hash/sample verification |
| Weekly | Full restore rehearsal | Isolated `joan_restore_test` | Counts, relationships, app smoke test |
| Quarterly | Disaster exercise | Staging/isolated server | Document actual recovery duration and gaps |

Do not depend on a single provider backup. Provider snapshots are useful but do not replace a company-controlled logical database export and media backup verified by restore.

## 3. Incident classification

| Severity | Example | First action |
|---|---|---|
| P1 | Public site unavailable, database corruption suspected, active data loss | Stop writes, preserve logs, invoke technical owner and business approver |
| P2 | Major route/API failure, media unavailable, admin unavailable | Stabilize service; prepare rollback if no quick contained fix |
| P3 | Single product/media/page defect with no data integrity impact | Create issue, correct in staging, release normally |

Never run destructive SQL, `DROP DATABASE`, bulk URL rewrite or media deletion during an incident without a current backup and an approved change record.

## 4. DNS / application rollback procedure

Use this after a failed cutover where the previous website remains the approved rollback target.

1. Declare the incident and stop further application writes on the new target.
2. Record the last successful order request/contact enquiry IDs and timestamp from both environments.
3. Change only the web routing records back to the saved old A/AAAA/CNAME values; **do not alter MX/TXT email records**.
4. Purge no data and do not delete the new server. Wait for DNS propagation according to the pre-cutover TTL.
5. Verify old canonical domain, HTTPS, homepage, three product URLs, a category URL, `robots.txt`, `sitemap.xml` and the old order/contact route.
6. Compare records created during the cutover window. If any business request reached only the new target, export and reconcile it under an approved data-recovery procedure before reattempting cutover.
7. Preserve server/database/media logs and the failed release artifact for diagnosis.

Rollback duration is not a fixed promise. It depends on DNS TTL/cache behavior, host recovery and the documented write reconciliation. Lower DNS TTL before the planned cutover reduces the uncertainty but does not eliminate recursive DNS caching.

## 5. Database recovery procedure

### Restore to a clean recovery database

```bash
mysql --host=<host> --user=<recovery-user> -p \
  -e "CREATE DATABASE joan_recovery CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

gunzip -c /srv/joan-backups/db/joan-<timestamp>.sql.gz | \
  mysql --host=<host> --user=<recovery-user> -p joan_recovery
```

### Validate before switching the application

```sql
USE joan_recovery;
SELECT COUNT(*) FROM catalogue_products;
SELECT COUNT(*) FROM catalogue_categories;
SELECT COUNT(*) FROM catalogue_product_category_links;
SELECT COUNT(*) FROM legacy_customer_orders;
SELECT COUNT(*) FROM legacy_customer_order_lines;
SELECT COUNT(*) FROM customer_profiles;
SELECT COUNT(*) FROM order_requests;
```

Then run `scripts/verify-database-migration.mjs` against the approved source/snapshot and recovery database. Only set `DATABASE_URL` to the recovered database after the report passes and the media manifest is also valid.

## 6. Media recovery procedure

1. Restore the `media/` tree into the exact configured `LOCAL_MEDIA_ROOT` path.
2. Verify count and SHA-256 values against the latest media download report.
3. Ensure the application process user has read access but not unreviewed write access to historic media.
4. Restart application service and request representative `/manus-storage/<key>` routes.
5. Check product primary image, gallery, category image, brochure PDF and brochure page image in a browser.

If media and database are restored from different points in time, image URL references can be missing. Treat the media and database snapshot pair as a single recovery set.

## 7. Process recovery

```bash
sudo systemctl status joan
sudo journalctl -u joan -n 200 --no-pager
sudo systemctl restart joan
curl -fsS https://joan.bg/ >/dev/null
curl -fsS https://joan.bg/robots.txt >/dev/null
curl -fsS https://joan.bg/sitemap.xml >/dev/null
```

Restarting a process is not a data recovery operation. If errors involve database writes, stop retries and verify data integrity before restarting traffic.

## 8. Cutover rollback gate

The business approver may authorise DNS cutover only when all conditions are true:

- The final database SQL archive and manifest exist and passed restore validation.
- The full media manifest reports no failed download and the media is available on target.
- Source-versus-target database validation is passed.
- Staging user acceptance includes SEO routes, catalogue, product images, request/contact flows and admin access plan.
- Previous DNS records, prior application target and responsible rollback operator are recorded.
- New writes are frozen or there is an explicit accepted reconciliation plan.
- Monitoring/log access and an incident communication owner are ready.

If any condition is false, delay the cutover. A delayed deployment is preferable to losing orders, prices, catalogue data or customer information.

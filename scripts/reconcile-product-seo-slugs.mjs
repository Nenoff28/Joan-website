import "dotenv/config";
import fs from "node:fs/promises";
import mysql from "mysql2/promise";
import { preferredProductSlug, uniqueProductSlug } from "./lib/product-slug.mjs";

const APPLY = process.argv.includes("--apply");
const REPORT_PATH = "/home/ubuntu/universal-export-audit/product-seo-slug-reconciliation.json";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [rows] = await connection.query(
    "SELECT id, legacyProductId, slug, legacyPublicSlug, name, legacySeoKeywordBg FROM catalogue_products WHERE isActive = 1 ORDER BY COALESCE(legacyProductId, id), id",
  );
  const targets = rows.filter((row) => !row.legacyPublicSlug && /^legacy-/.test(row.slug));
  const fixedSlugs = new Set(rows.filter((row) => !targets.some((target) => target.id === row.id)).map((row) => row.slug));
  const changes = targets.map((row) => ({
    id: row.id,
    legacyProductId: row.legacyProductId,
    previousSlug: row.slug,
    slug: uniqueProductSlug(preferredProductSlug(row), row.legacyProductId ?? row.id, fixedSlugs),
  }));
  const duplicateSuffixCount = changes.filter((row) => row.slug.endsWith(`-${row.legacyProductId}`) || /-\d+-\d+$/.test(row.slug)).length;
  const report = { dryRun: !APPLY, totalRows: rows.length, changed: changes.length, duplicateSuffixCount, sample: changes.slice(0, 20) };

  if (APPLY && changes.length) {
    await connection.beginTransaction();
    try {
      await connection.query("UPDATE catalogue_products SET slug = CONCAT('migrating-product-', id) WHERE isActive = 1 AND legacyPublicSlug IS NULL AND slug LIKE 'legacy-%'");
      for (let start = 0; start < changes.length; start += 250) {
        const batch = changes.slice(start, start + 250);
        const slugCases = batch.map(() => "WHEN ? THEN ?").join(" ");
        const legacyCases = batch.map(() => "WHEN ? THEN ?").join(" ");
        const ids = batch.map(() => "?").join(", ");
        await connection.execute(
          `UPDATE catalogue_products SET slug = CASE id ${slugCases} END, legacyPublicSlug = CASE id ${legacyCases} END WHERE id IN (${ids})`,
          [
            ...batch.flatMap((change) => [change.id, change.slug]),
            ...batch.flatMap((change) => [change.id, change.previousSlug]),
            ...batch.map((change) => change.id),
          ],
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }

  await fs.mkdir(new URL(".", `file://${REPORT_PATH}`).pathname, { recursive: true }).catch(() => {});
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await connection.end();
}

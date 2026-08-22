import fs from "node:fs";
import mysql from "mysql2/promise";
import { parse } from "csv-parse/sync";

const SOURCE = "/home/ubuntu/universal-export-audit/product.csv";
const APPLY = process.argv.includes("--apply");

function cell(value) {
  return String(value ?? "").trim();
}

function truthy(value) {
  return ["1", "true", "yes", "да"].includes(cell(value).toLowerCase());
}

function availabilityFromOpenCart(row) {
  const quantity = Math.max(0, Number(cell(row.quantity) || 0));
  if (!truthy(row.status)) return "out_of_stock";
  if (quantity > 0) return "in_stock";
  const status = cell(row.stock_status).toLocaleLowerCase("bg");
  if (status.includes("не е наличен") || status.includes("изчерпан")) return "out_of_stock";
  if (status.includes("по заявка") || status.includes("2-3 дена")) return "on_request";
  if (status.includes("на склад")) return "in_stock";
  return "on_request";
}

const rows = parse(fs.readFileSync(SOURCE, "utf8"), { columns: true, bom: true, skip_empty_lines: true, relax_column_count: true, relax_quotes: true });
const updates = rows.map((row) => ({ legacyProductId: Number(cell(row.product_id)), availability: availabilityFromOpenCart(row), stockQuantity: Math.max(0, Number(cell(row.quantity) || 0)) })).filter((row) => Number.isInteger(row.legacyProductId) && row.legacyProductId > 0);
const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [existingRows] = await connection.query("SELECT legacyProductId, availability, stockQuantity FROM catalogue_products WHERE legacyProductId IS NOT NULL");
  const existingByLegacyId = new Map(existingRows.map((row) => [Number(row.legacyProductId), row]));
  const changed = updates.filter((update) => {
    const existing = existingByLegacyId.get(update.legacyProductId);
    return existing && (existing.availability !== update.availability || Number(existing.stockQuantity) !== update.stockQuantity);
  });
  const report = { source: SOURCE, sourceRows: updates.length, storedRows: existingRows.length, changed: changed.length, byTargetAvailability: Object.fromEntries(["in_stock", "on_request", "out_of_stock"].map((availability) => [availability, changed.filter((row) => row.availability === availability).length])), product2432: changed.find((row) => row.legacyProductId === 2432) ?? updates.find((row) => row.legacyProductId === 2432) };
  if (APPLY) {
    for (let index = 0; index < changed.length; index += 500) {
      const batch = changed.slice(index, index + 500);
      await connection.query("INSERT INTO catalogue_products (legacyProductId, availability, stockQuantity, categoryId, slug, name, description, imageUrl, galleryJson, imageAlt, featuresJson, isActive) VALUES ? ON DUPLICATE KEY UPDATE availability = VALUES(availability), stockQuantity = VALUES(stockQuantity)", [batch.map((row) => [row.legacyProductId, row.availability, row.stockQuantity, 1, `reconcile-${row.legacyProductId}`, "reconcile", "reconcile", "/manus-storage/joan-existing-logo_61725b9d.webp", "[]", "reconcile", "[]", false])]);
    }
  }
  console.log(JSON.stringify({ ...report, applied: APPLY }, null, 2));
} finally {
  await connection.end();
}

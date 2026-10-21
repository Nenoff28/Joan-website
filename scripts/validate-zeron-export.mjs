#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.env.ZERON_EXPORT_DIR;
if (!root) {
  console.error("Usage: node scripts/validate-zeron-export.mjs <export-directory>");
  process.exit(2);
}

const requiredFiles = {
  "products.csv": [
    ["sku", "model", "code", "internal_code"],
    ["name", "product_name", "title"],
    ["category_code", "category", "category_id"],
    ["price_eur", "price", "unit_price"],
    ["stock_quantity", "quantity", "stock"],
  ],
  "categories.csv": [
    ["category_code", "code", "category_id"],
    ["name", "category_name", "title"],
    ["parent_code", "parent_id", "parent_category"],
  ],
};

const optionalFiles = {
  "product_categories.csv": ["sku", "category_code"],
  "product_images.csv": ["sku", "image_url"],
  "manufacturers.csv": ["brand_code", "brand_name"],
  "attributes.csv": ["sku", "attribute_name", "attribute_value"],
  "promotions.csv": ["sku"],
};

const normalize = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
const firstPresent = (headers, alternatives) => alternatives.find((name) => headers.includes(name));
const numeric = (value) => {
  const cleaned = String(value ?? "").trim().replace(/\s/g, "").replace(",", ".");
  return cleaned && Number.isFinite(Number(cleaned)) ? Number(cleaned) : null;
};

async function readCsv(filename) {
  const filenamePath = path.join(root, filename);
  try {
    const text = await fs.readFile(filenamePath, "utf8");
    const records = parse(text, {
      bom: true,
      columns: true,
      delimiter: [";", ",", "\t"],
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
    });
    const headers = Object.keys(records[0] ?? {}).map(normalize);
    return { filename, exists: true, records, headers };
  } catch (error) {
    if (error?.code === "ENOENT") return { filename, exists: false, records: [], headers: [] };
    throw new Error(`${filename}: ${error.message}`);
  }
}

const files = await Promise.all(Object.keys({ ...requiredFiles, ...optionalFiles }).map(readCsv));
const byName = new Map(files.map((file) => [file.filename, file]));
const issues = [];
const summary = {};

for (const [filename, requiredColumns] of Object.entries(requiredFiles)) {
  const file = byName.get(filename);
  if (!file.exists) {
    issues.push({ severity: "error", file: filename, issue: "липсва задължителен файл" });
    continue;
  }
  for (const alternatives of requiredColumns) {
    if (!firstPresent(file.headers, alternatives)) {
      issues.push({ severity: "error", file: filename, issue: `липсва колона: ${alternatives.join(" / ")}` });
    }
  }
}

for (const file of files) {
  if (!file.exists) continue;
  summary[file.filename] = { rows: file.records.length, headers: file.headers };
}

const products = byName.get("products.csv");
if (products?.exists) {
  const skuColumn = firstPresent(products.headers, requiredFiles["products.csv"][0]);
  const priceColumn = firstPresent(products.headers, requiredFiles["products.csv"][3]);
  const stockColumn = firstPresent(products.headers, requiredFiles["products.csv"][4]);
  const seen = new Map();
  for (const [index, row] of products.records.entries()) {
    const normalized = Object.fromEntries(Object.entries(row).map(([key, value]) => [normalize(key), value]));
    const sku = String(normalized[skuColumn] ?? "").trim();
    if (!sku) issues.push({ severity: "error", file: "products.csv", row: index + 2, issue: "празен SKU/вътрешен код" });
    else if (seen.has(sku)) issues.push({ severity: "error", file: "products.csv", row: index + 2, issue: `дублиран SKU ${sku}; първи ред ${seen.get(sku)}` });
    else seen.set(sku, index + 2);
    if (numeric(normalized[priceColumn]) === null || numeric(normalized[priceColumn]) < 0) {
      issues.push({ severity: "error", file: "products.csv", row: index + 2, issue: "невалидна цена" });
    }
    if (numeric(normalized[stockColumn]) === null) {
      issues.push({ severity: "warning", file: "products.csv", row: index + 2, issue: "липсващо или нечислово количество" });
    }
  }
}

const errorCount = issues.filter((issue) => issue.severity === "error").length;
const warningCount = issues.filter((issue) => issue.severity === "warning").length;
console.log(JSON.stringify({
  exportDirectory: root,
  readOnly: true,
  summary,
  issues: issues.slice(0, 200),
  issueCount: issues.length,
  errorCount,
  warningCount,
  valid: errorCount === 0,
}, null, 2));
process.exitCode = errorCount ? 1 : 0;

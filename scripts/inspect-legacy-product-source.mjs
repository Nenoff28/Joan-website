import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

const sourcePath = "/home/ubuntu/universal-export-audit/product.csv";
const categoryPathsPath = "/home/ubuntu/universal-export-audit/product_category_paths.json";
const requestedId = process.argv[2] ?? "4353";

function value(input) {
  return String(input ?? "").trim();
}

const [headers, ...rows] = parse(fs.readFileSync(sourcePath, "utf8"), {
  columns: false,
  bom: true,
  skip_empty_lines: true,
  relax_column_count: true,
  relax_quotes: true,
  trim: false,
});

const normalizedHeaders = headers.map((header, index) => value(header) || `column_${index}`);
const record = rows.map((cells) => Object.fromEntries(normalizedHeaders.map((header, index) => [header, cells[index] ?? ""]))).find((row) => value(row.product_id) === requestedId);

if (!record) {
  throw new Error(`No product source record found for legacy product ID ${requestedId}.`);
}

const selected = Object.fromEntries(Object.entries(record).filter(([key, field]) => {
  const normalized = key.toLowerCase();
  return value(field) && /(product_id|model|sku|name|description|price|special|date|status|category|seo|canonical)/.test(normalized);
}));

const categoryPaths = JSON.parse(fs.readFileSync(categoryPathsPath, "utf8"));

console.log(JSON.stringify({ legacyProductId: requestedId, categoryPaths: categoryPaths[requestedId] ?? [], fields: selected }, null, 2));

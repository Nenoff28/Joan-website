import fs from "node:fs";
import { parse } from "csv-parse/sync";

const raw = fs.readFileSync("/home/ubuntu/universal-export-audit/product.csv", "utf8");
const records = parse(raw, { columns: true, bom: true, relax_quotes: true, relax_column_count: true, skip_empty_lines: true });
const columns = ["price", "price_special", "special_price_for_group_1", "product_special", "product_discount"];
const results = {};
for (const column of columns) {
  const nonEmpty = records.filter((row) => String(row[column] ?? "").trim() !== "");
  const numeric = nonEmpty.filter((row) => Number.isFinite(Number(String(row[column]).replace(",", "."))));
  results[column] = { nonEmpty: nonEmpty.length, numeric: numeric.length };
}
const output = { parsedRecords: records.length, priceFields: results };
fs.writeFileSync("/home/ubuntu/universal-export-audit/legacy_price_fields.json", JSON.stringify(output, null, 2));
console.log(JSON.stringify(output));

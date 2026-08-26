import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("English catalogue translation contract", () => {
  const schema = fs.readFileSync(path.resolve(import.meta.dirname, "../drizzle/schema.ts"), "utf8");
  const script = fs.readFileSync(path.resolve(import.meta.dirname, "../scripts/generate-english-catalogue-translations.mjs"), "utf8");

  it("keeps English catalogue content separate from the Bulgarian product and category source tables", () => {
    expect(schema).toContain('mysqlTable("catalogue_product_english"');
    expect(schema).toContain('mysqlTable("catalogue_category_english"');
    expect(schema).toContain("sourceContentHash");
  });

  it("uses a resumable translation process with a no-Cyrillic quality gate and no source-table mutation", () => {
    expect(script).toContain("ON DUPLICATE KEY UPDATE");
    expect(script).toContain("Translation response still contains Cyrillic text");
    expect(script).not.toContain("UPDATE catalogue_products");
    expect(script).not.toContain("UPDATE catalogue_categories");
    expect(script).not.toContain("DELETE FROM catalogue_products");
    expect(script).not.toContain("DELETE FROM catalogue_categories");
  });
});

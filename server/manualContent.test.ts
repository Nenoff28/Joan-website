import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("manual product content editor", () => {
  const page = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/AdminManualContent.tsx"), "utf8");
  const service = fs.readFileSync(path.resolve(import.meta.dirname, "./aiContentService.ts"), "utf8");
  const stylesheet = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/index.css"), "utf8");

  it("loads the current live product content instead of an old AI draft", () => {
    expect(service).toContain("slug: row.product.slug");
    expect(service).toContain("oldDescription: row.product.description");
    expect(service).toContain("oldFeatures: formatLegacyFeatures(row.product.featuresJson)");
    expect(service).toContain("oldSeoTitle: row.product.legacyMetaTitleBg");
    expect(service).toContain("oldSeoDescription: row.product.legacyMetaDescriptionBg");
    expect(service).toContain("oldKeywords: row.product.legacySeoKeywordBg");
    expect(page).toContain("selected.oldDescription");
    expect(page).toContain("selected.oldFeatures");
    expect(page).toContain("selected.oldSeoTitle");
    expect(page).toContain("selected.oldSeoDescription");
    expect(page).toContain("selected.oldKeywords");
  });

  it("opens the exact selected product in the public site", () => {
    expect(page).toContain('href={`/product/${selected.slug}`}');
    expect(page).toContain('target="_blank"');
    expect(page).toContain("Виж в сайта");
    expect(stylesheet).toContain(".admin-manual-view-button");
  });

  it("does not overwrite the form with refreshed data while editing the same product", () => {
    expect(page).toContain("}, [selectedId]);");
    expect(page).not.toContain("}, [selected]);");
  });
});

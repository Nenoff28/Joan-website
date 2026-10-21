import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseAiJsonObject, validateAiPayload } from "./aiContentService";

describe("AI product content generation", () => {
  it("extracts the first balanced JSON object from surrounding prose or markdown", () => {
    expect(parseAiJsonObject('Ето резултата:\n```json\n{"description":"Текст {със скоби}","features":[]}\n```')).toEqual({
      description: "Текст {със скоби}",
      features: [],
    });
  });

  it("rejects responses without a complete JSON object", () => {
    expect(() => parseAiJsonObject("Не мога да генерирам съдържание.")).toThrow("не съдържа JSON");
    expect(() => parseAiJsonObject('{"description":"незавършен"')).toThrow("незавършен JSON");
  });

  it("enforces the product-content quality limits", () => {
    expect(validateAiPayload({ description: "Описание", features: [], seo_title: "Кратко заглавие", seo_description: "Кратко SEO описание", keywords: "боя, лак", confidence: "висока", source_urls: ["https://example.com/product"] })).toEqual([]);
    expect(validateAiPayload({ description: "", features: {}, seo_title: "x".repeat(61), seo_description: "x".repeat(201), keywords: "x".repeat(256), confidence: "medium" })).toEqual([
      "description трябва да е непразен текст",
      "seo_title трябва да е до 60 знака",
      "seo_description трябва да е до 200 знака",
      "keywords трябва да е до 255 знака",
      "features трябва да е масив от низове; празен масив е допустим",
      "confidence трябва да е „висока“ или „ниска“",
      "source_urls трябва да съдържа поне един валиден URL",
    ]);
    expect(validateAiPayload({ description: "Няма информация", features: [], seo_title: "Заглавие", seo_description: "Описание", keywords: "ключова дума", confidence: "ниска", source_urls: ["https://example.com"] })).toContain("съдържанието не трябва да съдържа фрази без информационна стойност");
  });

  it("keeps AI fields isolated and records generation errors without clearing previous content", () => {
    const schema = fs.readFileSync(path.resolve(import.meta.dirname, "../drizzle/schema.ts"), "utf8");
    const service = fs.readFileSync(path.resolve(import.meta.dirname, "./aiContentService.ts"), "utf8");
    const router = fs.readFileSync(path.resolve(import.meta.dirname, "./routers.ts"), "utf8");
    expect(schema).toContain('mysqlTable("catalogue_product_ai_content"');
    expect(schema).toContain('mysqlTable("catalogue_product_ai_backups"');
    expect(schema).toContain('unique().references(() => catalogueProducts.id)');
    expect(schema).toContain('mysqlTable("ai_content_settings"');
    expect(service).toContain('model: DEFAULT_AI_MODEL');
    expect(service).toContain('name: "web_search"');
    expect(service).toContain("validateAiPayload");
    expect(service).toContain("for (let attempt = 0; attempt <= 2");
    expect(service).toContain("parseAiJsonObject(raw)");
    expect(service).toContain('aiStatus: "error"');
    expect(service).toContain("onDuplicateKeyUpdate({ set: { aiStatus: \"error\"");
    expect(service).toContain("publishApprovedAiContent");
    expect(service).toContain("restoreAiBackups");
    expect(service).toContain("aiFeaturesToJson");
    expect(router).toContain("generateAiContent");
    expect(router).toContain("saveAiSettings");
    expect(router).toContain("publishApprovedAiContent");
    expect(router).toContain("restoreAiBackups");
  });
});

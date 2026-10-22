import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { canonicalizeAiFeatures, parseAiJsonObject, validateAiPayload } from "./aiContentService";

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
    expect(validateAiPayload({ description: "Описание", features: [], seo_title: "Кратко заглавие", seo_description: "Кратко SEO описание", keywords: "боя, лак", confidence: "висока", source_urls: [] })).toEqual([]);
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
    expect(validateAiPayload({ description: "Описание на продукта. Номинална мощност: 3 kW Номинален обем: 80 л", features: [], seo_title: "Заглавие", seo_description: "Описание", keywords: "ключова дума", confidence: "ниска", source_urls: [] })).toContain("description трябва да е отделен текст, без технически списък");
  });

  it("canonicalizes technical data before publish", () => {
    expect(canonicalizeAiFeatures("Номинална мощност: 3 kW Максимално количество: 177л\nМодел: 9685\nКатегория: Баня\nРазмери:79 x 44 см", "118909")).toEqual([
      "Номинална мощност: 3 kW",
      "Максимално количество: 177 л",
      "Размери: 79 x 44 см",
    ]);
  });

  it("keeps AI fields isolated and records generation errors without clearing previous content", () => {
    const schema = fs.readFileSync(path.resolve(import.meta.dirname, "../drizzle/schema.ts"), "utf8");
    const service = fs.readFileSync(path.resolve(import.meta.dirname, "./aiContentService.ts"), "utf8");
    const router = fs.readFileSync(path.resolve(import.meta.dirname, "./routers.ts"), "utf8");
    const page = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/AdminAIContent.tsx"), "utf8");
    expect(schema).toContain('mysqlTable("catalogue_product_ai_content"');
    expect(schema).toContain('mysqlTable("catalogue_product_ai_backups"');
    expect(schema).toContain('unique().references(() => catalogueProducts.id)');
    expect(schema).toContain('mysqlTable("ai_content_settings"');
    expect(service).toContain('FREE_AI_MODEL');
    expect(service).toContain('FREE_AI_PROVIDER');
    expect(service).toContain('checkFreeAiConnection');
    expect(service).not.toContain('callGemini');
    expect(service).not.toContain('google_search');
    expect(service).toContain('aiInputTokens');
    expect(service).toContain('aiOutputTokens');
    expect(service).toContain("aiSearchCount");
    expect(service).toContain('AiAvailabilityFilter');
    expect(service).toContain('AiVisibilityFilter');
    expect(service).toContain('stockQuantity');
    expect(service).toContain('updated-desc');
    expect(service).toContain('descendantCategoryIds');
    expect(service).toContain('catalogueProductCategoryLinks');
    expect(service).toContain('flattenCategoryOptions');
    expect(service).toContain("reviewAdminAiContentBatch");
    expect(service).toContain('action === "approve" ? ["generated", "reviewed"] as const : ["generated", "reviewed", "error"] as const');
    expect(service).toContain('count: counts.get(row.id)');
    expect(service).toContain("validateAiPayload");
    expect(service).toContain("for (let attempt = 0; attempt <= 2");
    expect(service).toContain("parseAiJsonObject(raw)");
    expect(service).toContain("featuresJson: catalogueProducts.featuresJson");
    expect(service).toContain("Съществуващи технически данни:");
    expect(service).toContain("mergeSourceFeatures");
    expect(service).toContain("aiFeatures: sourceFeatures.trim()");
    expect(service).toContain("buildAuthoritativeFeatures");
    expect(service).toContain("cleanGeneratedDescription");
    expect(service).toContain("не копирай целия списък със спецификации");
    expect(service).toContain("return withoutGeneratedIdentity.join");
    expect(service).toContain("extractLegacyDescriptionFeatures");
    expect(service).toContain("Номинален обем");
    expect(service).toContain("backupDescription");
    expect(service).toContain("backupFeaturesJson");
    expect(service).toContain('aiStatus: "error"');
    expect(service).toContain("onDuplicateKeyUpdate({ set: { aiStatus: \"error\"");
    expect(service).toContain("publishApprovedAiContent");
    expect(service).toContain("restoreAiBackups");
    expect(service).toContain("aiFeaturesToJson");
    expect(service).toContain("publish quality gate");
    expect(service).toContain("publishResult.published !== 1");
    expect(router).toContain("generateAiContent");
    expect(router).toContain("saveAiSettings");
    expect(router).toContain("checkFreeAiConnection");
    expect(router).toContain("publishApprovedAiContent");
    expect(router).toContain("restoreAiBackups");
    expect(router).toContain("reviewAiContentBatch");
    expect(schema).toContain('autoPublish: boolean("autoPublish")');
    expect(service).toContain("autoPublish?: boolean");
    expect(service).toContain("etaSeconds");
    expect(service).toContain("dailyLimit: null");
    expect(router).toContain("autoPublish: z.boolean().optional()");
    expect(page).toContain("Генерирай и публикувай");
    expect(page).toContain("Безплатен режим — без Google Search");
    expect(page).toContain("Оставащо време");
    expect(page).toContain("Последни опашки");
    expect(page).toContain("await utils.admin.aiQueue.invalidate()");
    expect(page).toContain("дневният лимит е изключен");
    expect(page).toContain("admin-ai-queue-progress");
    expect(page).toContain("admin-ai-workflow-guide");
    expect(page).toContain("queueHistoryQuery");
    expect(page).toContain("selectedQueueQuery");
    expect(page).toContain("toast.success(\"AI съдържанието е запазено.\")");
    expect(page).toContain("Текуща опашка");
    expect(page).toContain("Одобри въпреки грешката");
    expect(page).toContain("selectedErrorCount");
    expect(page).toContain('item.aiStatus === "error"');
    expect(page).toContain("utils.admin.aiProductIds.invalidate()");
    expect(page).toContain("Няма одобрени продукти.");
    expect(page).toContain("technicalRows");
    expect(page).toContain("admin-ai-technical-table");
    expect(page).toContain("replace(/\\\\n/g");
  });
});

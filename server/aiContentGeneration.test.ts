import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseAiJsonObject } from "./aiContentService";

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

  it("keeps AI fields isolated and records generation errors without clearing previous content", () => {
    const schema = fs.readFileSync(path.resolve(import.meta.dirname, "../drizzle/schema.ts"), "utf8");
    const service = fs.readFileSync(path.resolve(import.meta.dirname, "./aiContentService.ts"), "utf8");
    const router = fs.readFileSync(path.resolve(import.meta.dirname, "./routers.ts"), "utf8");
    expect(schema).toContain('mysqlTable("catalogue_product_ai_content"');
    expect(schema).toContain('mysqlTable("ai_content_settings"');
    expect(service).toContain('model: DEFAULT_AI_MODEL');
    expect(service).toContain("parseAiJsonObject(raw)");
    expect(service).toContain('aiStatus: "error"');
    expect(service).toContain("onDuplicateKeyUpdate({ set: { aiStatus: \"error\"");
    expect(router).toContain("generateAiContent");
    expect(router).toContain("saveAiSettings");
  });
});

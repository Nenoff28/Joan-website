import { and, asc, count, desc, eq, inArray, isNull, like, lt, lte, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { aiContentSettings, aiGenerationBatches, aiGenerationDailyUsage, aiGenerationJobs, catalogueProductAiBackups, catalogueProductAiContent, catalogueCategories, catalogueProducts } from "../drizzle/schema";
import { getDb } from "./db";
import { invokeLLM, type Message, type Tool } from "./_core/llm";

export type AiContentStatus = "pending" | "generated" | "reviewed" | "published" | "error";
export type AiContentConfidence = "high" | "low";

const DEFAULT_AI_MODEL = "gpt-6-luna";
const WEB_SEARCH_TOOL: Tool = {
  type: "function",
  function: {
    name: "web_search",
    description: "Търси актуални продуктови данни в публичния интернет и връща заглавие, URL и кратък откъс.",
    parameters: { type: "object", properties: { query: { type: "string", minLength: 2, maxLength: 240 } }, required: ["query"], additionalProperties: false },
  },
};

async function database() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Базата данни временно не е достъпна." });
  return db;
}

function parseSourceUrls(value: string | null) {
  if (!value) return [] as string[];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return value.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
  }
}

function formatLegacyFeatures(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(item => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const label = typeof record.name === "string" ? record.name : typeof record.label === "string" ? record.label : "";
        const content = typeof record.value === "string" ? record.value : typeof record.description === "string" ? record.description : "";
        return label && content ? `${label}: ${content}` : label || content;
      }
      return "";
    }).filter(Boolean).join("\n");
  } catch {
    return value;
  }
  return value;
}

function mapRow(row: { product: typeof catalogueProducts.$inferSelect; category: typeof catalogueCategories.$inferSelect; ai: typeof catalogueProductAiContent.$inferSelect | null; backup: typeof catalogueProductAiBackups.$inferSelect | null }) {
  return {
    productId: row.product.id,
    name: row.product.name,
    sku: row.product.sku,
    brand: row.product.brand,
    imageUrl: row.product.imageUrl,
    categoryName: row.category.name,
    oldDescription: row.product.description,
    oldFeatures: formatLegacyFeatures(row.product.featuresJson),
    oldSeoTitle: row.product.legacyMetaTitleBg,
    oldSeoDescription: row.product.legacyMetaDescriptionBg,
    oldKeywords: row.product.legacySeoKeywordBg,
    isActive: row.product.isActive,
    isArchived: row.product.isArchived,
    aiStatus: row.ai?.aiStatus ?? "pending",
    aiDescription: row.ai?.aiDescription ?? null,
    aiFeatures: row.ai?.aiFeatures ?? null,
    aiSeoTitle: row.ai?.aiSeoTitle ?? null,
    aiSeoDescription: row.ai?.aiSeoDescription ?? null,
    aiKeywords: row.ai?.aiKeywords ?? null,
    aiSourceUrls: parseSourceUrls(row.ai?.aiSourceUrls ?? null),
    aiConfidence: row.ai?.aiConfidence ?? null,
    aiError: row.ai?.aiError ?? null,
    aiGeneratedAt: row.ai?.aiGeneratedAt ?? null,
    canRestore: Boolean(row.backup && !row.backup.restoredAt),
  };
}

export async function getAdminAiContent(input?: { status?: AiContentStatus; confidence?: AiContentConfidence; query?: string; page?: number; pageSize?: number }) {
  const db = await database();
  const page = input?.page ?? 1;
  const pageSize = input?.pageSize ?? 50;
  const conditions = [eq(catalogueProducts.isArchived, false), eq(catalogueCategories.isArchived, false)];
  if (input?.status) conditions.push(eq(catalogueProductAiContent.aiStatus, input.status));
  if (input?.confidence) conditions.push(eq(catalogueProductAiContent.aiConfidence, input.confidence));
  const query = input?.query?.trim();
  if (query) conditions.push(or(like(catalogueProducts.name, `%${query}%`), like(catalogueProducts.sku, `%${query}%`), like(catalogueProducts.brand, `%${query}%`))!);

  const [rows, totals, statusCounts] = await Promise.all([
    db.select({ product: catalogueProducts, category: catalogueCategories, ai: catalogueProductAiContent, backup: catalogueProductAiBackups })
      .from(catalogueProducts)
      .innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id))
      .leftJoin(catalogueProductAiContent, eq(catalogueProductAiContent.productId, catalogueProducts.id))
      .leftJoin(catalogueProductAiBackups, eq(catalogueProductAiBackups.productId, catalogueProducts.id))
      .where(and(...conditions))
      .orderBy(desc(sql`CASE WHEN ${catalogueProductAiContent.aiConfidence} = 'low' THEN 1 ELSE 0 END`), asc(catalogueProducts.name), asc(catalogueProducts.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() })
      .from(catalogueProducts)
      .innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id))
      .leftJoin(catalogueProductAiContent, eq(catalogueProductAiContent.productId, catalogueProducts.id))
      .where(and(...conditions)),
    db.select({ status: catalogueProductAiContent.aiStatus, total: count() })
      .from(catalogueProducts)
      .innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id))
      .leftJoin(catalogueProductAiContent, eq(catalogueProductAiContent.productId, catalogueProducts.id))
      .where(and(eq(catalogueProducts.isArchived, false), eq(catalogueCategories.isArchived, false)))
      .groupBy(catalogueProductAiContent.aiStatus),
  ]);

  const counts: Record<AiContentStatus, number> = { pending: 0, generated: 0, reviewed: 0, published: 0, error: 0 };
  for (const item of statusCounts) counts[(item.status ?? "pending") as AiContentStatus] = Number(item.total ?? 0);
  return { items: rows.map(mapRow), total: Number(totals[0]?.total ?? 0), page, pageSize, counts };
}

export async function saveAdminAiContent(input: {
  productId: number;
  aiStatus: AiContentStatus;
  aiDescription?: string | null;
  aiFeatures?: string | null;
  aiSeoTitle?: string | null;
  aiSeoDescription?: string | null;
  aiKeywords?: string | null;
  aiSourceUrls?: string[];
  aiConfidence?: AiContentConfidence | null;
  aiError?: string | null;
  aiGeneratedAt?: string | null;
}) {
  const db = await database();
  const [product] = await db.select({ id: catalogueProducts.id }).from(catalogueProducts).where(eq(catalogueProducts.id, input.productId)).limit(1);
  if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Продуктът не е намерен." });
  const values = {
    productId: input.productId,
    aiStatus: input.aiStatus,
    aiDescription: input.aiDescription?.trim() || null,
    aiFeatures: input.aiFeatures?.trim() || null,
    aiSeoTitle: input.aiSeoTitle?.trim() || null,
    aiSeoDescription: input.aiSeoDescription?.trim() || null,
    aiKeywords: input.aiKeywords?.trim() || null,
    aiSourceUrls: JSON.stringify(input.aiSourceUrls ?? []),
    aiConfidence: input.aiConfidence ?? null,
    aiError: input.aiError?.trim() || null,
    aiGeneratedAt: input.aiGeneratedAt ? new Date(input.aiGeneratedAt) : null,
  };
  await db.insert(catalogueProductAiContent).values(values).onDuplicateKeyUpdate({ set: values });
  return { success: true } as const;
}

export async function reviewAdminAiContent(productId: number, action: "approve" | "reject") {
  const db = await database();
  const [product] = await db.select({ id: catalogueProducts.id }).from(catalogueProducts).where(eq(catalogueProducts.id, productId)).limit(1);
  if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Продуктът не е намерен." });
  const nextStatus = action === "approve" ? "reviewed" as const : "pending" as const;
  await db.insert(catalogueProductAiContent).values({ productId, aiStatus: nextStatus, aiError: null }).onDuplicateKeyUpdate({ set: { aiStatus: nextStatus, aiError: null } });
  return { success: true, aiStatus: nextStatus } as const;
}

function aiFeaturesToJson(value: string | null) {
  return JSON.stringify((value ?? "").split(/\r?\n/).map(item => item.trim()).filter(Boolean));
}

export async function publishApprovedAiContent(productIds?: number[]) {
  const db = await database();
  const ids = productIds?.length ? Array.from(new Set(productIds)).slice(0, 10_000) : null;
  let published = 0;
  const skipped: number[] = [];
  await db.transaction(async tx => {
    const rows = await tx.select({ product: catalogueProducts, ai: catalogueProductAiContent })
      .from(catalogueProducts)
      .innerJoin(catalogueProductAiContent, eq(catalogueProductAiContent.productId, catalogueProducts.id))
      .where(ids ? and(inArray(catalogueProducts.id, ids), eq(catalogueProductAiContent.aiStatus, "reviewed")) : eq(catalogueProductAiContent.aiStatus, "reviewed"));
    if (ids) {
      const found = new Set(rows.map(row => row.product.id));
      for (const id of ids) if (!found.has(id)) skipped.push(id);
    }
    for (const row of rows) {
      const [existingBackup] = await tx.select().from(catalogueProductAiBackups).where(eq(catalogueProductAiBackups.productId, row.product.id)).limit(1);
      if (!existingBackup || existingBackup.restoredAt) {
        const backupValues = { productId: row.product.id, description: row.product.description, featuresJson: row.product.featuresJson, seoTitle: row.product.legacyMetaTitleBg, seoDescription: row.product.legacyMetaDescriptionBg, keywords: row.product.legacySeoKeywordBg, restoredAt: null };
        if (existingBackup) await tx.update(catalogueProductAiBackups).set(backupValues).where(eq(catalogueProductAiBackups.productId, row.product.id));
        else await tx.insert(catalogueProductAiBackups).values(backupValues);
      }
      await tx.update(catalogueProducts).set({ description: row.ai.aiDescription ?? row.product.description, featuresJson: aiFeaturesToJson(row.ai.aiFeatures), legacyMetaTitleBg: row.ai.aiSeoTitle, legacyMetaDescriptionBg: row.ai.aiSeoDescription, legacySeoKeywordBg: row.ai.aiKeywords }).where(eq(catalogueProducts.id, row.product.id));
      await tx.update(catalogueProductAiContent).set({ aiStatus: "published", aiError: null }).where(eq(catalogueProductAiContent.productId, row.product.id));
      published += 1;
    }
  });
  return { published, skipped } as const;
}

export async function restoreAiBackups(productIds: number[]) {
  const db = await database();
  const ids = Array.from(new Set(productIds)).slice(0, 10_000);
  if (!ids.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Изберете поне един продукт." });
  let restored = 0;
  const skipped: number[] = [];
  await db.transaction(async tx => {
    const rows = await tx.select({ product: catalogueProducts, backup: catalogueProductAiBackups })
      .from(catalogueProducts)
      .innerJoin(catalogueProductAiBackups, eq(catalogueProductAiBackups.productId, catalogueProducts.id))
      .where(and(inArray(catalogueProducts.id, ids), isNull(catalogueProductAiBackups.restoredAt)));
    const found = new Set(rows.map(row => row.product.id));
    for (const id of ids) if (!found.has(id)) skipped.push(id);
    for (const row of rows) {
      await tx.update(catalogueProducts).set({ description: row.backup.description, featuresJson: row.backup.featuresJson, legacyMetaTitleBg: row.backup.seoTitle, legacyMetaDescriptionBg: row.backup.seoDescription, legacySeoKeywordBg: row.backup.keywords }).where(eq(catalogueProducts.id, row.product.id));
      await tx.update(catalogueProductAiBackups).set({ restoredAt: new Date() }).where(eq(catalogueProductAiBackups.productId, row.product.id));
      await tx.update(catalogueProductAiContent).set({ aiStatus: "reviewed" }).where(eq(catalogueProductAiContent.productId, row.product.id));
      restored += 1;
    }
  });
  return { restored, skipped } as const;
}

export async function getAdminAiSettings() {
  const db = await database();
  const [settings] = await db.select().from(aiContentSettings).where(eq(aiContentSettings.id, 1)).limit(1);
  if (!settings) throw new TRPCError({ code: "NOT_FOUND", message: "AI системният prompt не е настроен." });
  return { systemPrompt: settings.systemPrompt, dailyGenerationLimit: settings.dailyGenerationLimit, updatedAt: settings.updatedAt };
}

export async function saveAdminAiSettings(systemPrompt: string, dailyGenerationLimit: number) {
  const prompt = systemPrompt.trim();
  if (prompt.length < 20) throw new TRPCError({ code: "BAD_REQUEST", message: "Системният prompt трябва да съдържа поне 20 знака." });
  if (prompt.length > 100_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Системният prompt е прекалено дълъг." });
  if (!Number.isInteger(dailyGenerationLimit) || dailyGenerationLimit < 0 || dailyGenerationLimit > 100_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Дневният лимит трябва да е цяло число между 0 и 100 000." });
  const db = await database();
  await db.insert(aiContentSettings).values({ id: 1, systemPrompt: prompt, dailyGenerationLimit }).onDuplicateKeyUpdate({ set: { systemPrompt: prompt, dailyGenerationLimit } });
  return { success: true, systemPrompt: prompt, dailyGenerationLimit } as const;
}

function llmResponseText(content: unknown) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.filter((part): part is { type: "text"; text: string } => Boolean(part && typeof part === "object" && (part as { type?: unknown }).type === "text" && typeof (part as { text?: unknown }).text === "string")).map(part => part.text).join("\n");
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
}

async function runWebSearch(query: string) {
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query.slice(0, 240))}`;
  const response = await fetch(url, { headers: { "user-agent": "Joan.bg product research bot/1.0" } });
  if (!response.ok) throw new Error(`Web search failed with HTTP ${response.status}.`);
  const html = await response.text();
  const results: Array<{ title: string; url: string; snippet: string }> = [];
  const pattern = /<a[^>]+href="([^"]*uddg=[^"]+)"[^>]+class='result-link'[^>]*>([\s\S]*?)<\/a>[\s\S]*?<td class='result-snippet'>\s*([\s\S]*?)<\/td>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const resultUrl = new URLSearchParams(match[1].split("?")[1] || "").get("uddg");
    if (!resultUrl || !/^https?:\/\//i.test(resultUrl)) continue;
    results.push({ title: stripHtml(match[2]), url: resultUrl, snippet: stripHtml(match[3]) });
    if (results.length >= 6) break;
  }
  return { query, results };
}

/** Finds and parses the first balanced JSON object, even when the model adds prose or markdown around it. */
export function parseAiJsonObject(raw: string): Record<string, unknown> {
  const start = raw.indexOf("{");
  if (start < 0) throw new Error("LLM отговорът не съдържа JSON обект.");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < raw.length; index += 1) {
    const character = raw[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') { inString = true; continue; }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        let parsed: unknown;
        try { parsed = JSON.parse(raw.slice(start, index + 1)); } catch { throw new Error("LLM отговорът съдържа невалиден JSON обект."); }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("LLM отговорът не е JSON обект.");
        return parsed as Record<string, unknown>;
      }
    }
  }
  throw new Error("LLM отговорът съдържа незавършен JSON обект.");
}

function textField(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

export function validateAiPayload(payload: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const features = payload.features;
  const sourceUrls = payload.source_urls;
  if (!textField(payload.description)) errors.push("description трябва да е непразен текст");
  if (typeof payload.seo_title !== "string" || payload.seo_title.trim().length > 60) errors.push("seo_title трябва да е до 60 знака");
  if (typeof payload.seo_description !== "string" || payload.seo_description.trim().length > 200) errors.push("seo_description трябва да е до 200 знака");
  if (typeof payload.keywords !== "string" || payload.keywords.trim().length > 255) errors.push("keywords трябва да е до 255 знака");
  if (!Array.isArray(features) || features.some(item => typeof item !== "string" || !item.trim())) errors.push("features трябва да е масив от низове; празен масив е допустим");
  if (typeof payload.confidence !== "string" || !["висока", "ниска"].includes(payload.confidence.trim().toLowerCase())) errors.push('confidence трябва да е „висока“ или „ниска“');
  if (!Array.isArray(sourceUrls) || sourceUrls.length === 0 || sourceUrls.some(item => typeof item !== "string" || !/^https?:\/\//i.test(item))) errors.push("source_urls трябва да съдържа поне един валиден URL");
  const searchableText = [payload.description, payload.seo_title, payload.seo_description, payload.keywords, ...(Array.isArray(features) ? features : [])].filter((value): value is string => typeof value === "string").join(" ").toLowerCase();
  if (/няма информация|не е налично|не е налична|няма данни|неизвестно/.test(searchableText)) errors.push("съдържанието не трябва да съдържа фрази без информационна стойност");
  return errors;
}

function normalizeAiPayload(payload: Record<string, unknown>) {
  const confidence = textField(payload.confidence).toLowerCase();
  return {
    aiDescription: textField(payload.description) || null,
    aiFeatures: Array.isArray(payload.features) ? payload.features.filter((item): item is string => typeof item === "string").join("\n") || null : null,
    aiSeoTitle: textField(payload.seo_title) || null,
    aiSeoDescription: textField(payload.seo_description) || null,
    aiKeywords: textField(payload.keywords) || null,
    aiSourceUrls: Array.isArray(payload.source_urls) ? payload.source_urls.filter((item): item is string => typeof item === "string" && /^https?:\/\//i.test(item)) : [],
    aiConfidence: confidence === "висока" || confidence === "high" ? "high" as const : "low" as const,
  };
}

async function reserveDailyGeneration(db: Awaited<ReturnType<typeof database>>, limit: number) {
  if (limit <= 0) return false;
  const usageDate = new Date().toISOString().slice(0, 10);
  const updated = await db.update(aiGenerationDailyUsage).set({ generatedCount: sql`${aiGenerationDailyUsage.generatedCount} + 1` }).where(and(eq(aiGenerationDailyUsage.usageDate, usageDate), lt(aiGenerationDailyUsage.generatedCount, limit)));
  const affectedRows = Number((updated as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0);
  if (affectedRows > 0) return true;
  try {
    await db.insert(aiGenerationDailyUsage).values({ usageDate, generatedCount: 1 });
    return true;
  } catch {
    const retry = await db.update(aiGenerationDailyUsage).set({ generatedCount: sql`${aiGenerationDailyUsage.generatedCount} + 1` }).where(and(eq(aiGenerationDailyUsage.usageDate, usageDate), lt(aiGenerationDailyUsage.generatedCount, limit)));
    return Number((retry as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0) > 0;
  }
}

export async function generateAdminAiContent(productId: number, options?: { skipQuota?: boolean }) {
  const db = await database();
  const [product] = await db.select({ id: catalogueProducts.id, name: catalogueProducts.name, brand: catalogueProducts.brand, sku: catalogueProducts.sku }).from(catalogueProducts).where(eq(catalogueProducts.id, productId)).limit(1);
  if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Продуктът не е намерен." });
  const [settings] = await db.select().from(aiContentSettings).where(eq(aiContentSettings.id, 1)).limit(1);
  if (!settings) throw new TRPCError({ code: "NOT_FOUND", message: "AI системният prompt не е настроен." });
  if (!options?.skipQuota && !(await reserveDailyGeneration(db, settings.dailyGenerationLimit))) {
    const message = "Дневният лимит за AI генерирания е достигнат.";
    await db.insert(catalogueProductAiContent).values({ productId, aiStatus: "error", aiError: message, aiGeneratedAt: new Date() }).onDuplicateKeyUpdate({ set: { aiStatus: "error", aiError: message, aiGeneratedAt: new Date() } });
    return { success: false, status: "error" as const, error: message };
  }

  const productInput = `Марка: ${product.brand || "няма посочена"}\nИме на продукта: ${product.name}\nEAN/артикулен номер: ${product.sku || "няма посочен"}`;
  let lastError = "AI резултатът не премина програмната проверка.";
  for (let attempt = 0; attempt <= 2; attempt += 1) {
    try {
      const correction = attempt === 0 ? "" : `\n\nПредишният отговор не премина програмната проверка: ${lastError}\nВърни отново само коригиран валиден JSON обект, като спазиш всички ограничения за дължини и типове.`;
      const messages: Message[] = [
        { role: "system", content: settings.systemPrompt + "\n\nЗадължително използвай web_search поне веднъж, за да провериш точния продукт, преди да върнеш JSON." },
        { role: "user", content: productInput + correction },
      ];
      let response;
      for (let toolRound = 0; toolRound < 4; toolRound += 1) {
        response = await invokeLLM({ model: DEFAULT_AI_MODEL, maxTokens: 5000, reasoning: { effort: "low" }, messages, tools: [WEB_SEARCH_TOOL], toolChoice: "auto" });
        const message = response.choices?.[0]?.message;
        if (!message?.tool_calls?.length) break;
        messages.push({ role: "assistant", content: message.content || "" });
        for (const toolCall of message.tool_calls) {
          if (toolCall.function.name !== "web_search") throw new Error(`Неподдържан AI tool: ${toolCall.function.name}`);
          let toolInput: unknown;
          try { toolInput = JSON.parse(toolCall.function.arguments); } catch { throw new Error("AI web_search заявката е невалиден JSON."); }
          const searchQuery = toolInput && typeof toolInput === "object" && typeof (toolInput as { query?: unknown }).query === "string" ? (toolInput as { query: string }).query : "";
          if (searchQuery.trim().length < 2) throw new Error("AI web_search заявката няма валидна заявка.");
          messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(await runWebSearch(searchQuery)) });
        }
      }
      if (!response) throw new Error("AI не върна резултат.");
      const raw = llmResponseText(response.choices?.[0]?.message?.content);
      const parsed = parseAiJsonObject(raw);
      const validationErrors = validateAiPayload(parsed);
      if (validationErrors.length > 0) {
        lastError = validationErrors.join("; ");
        continue;
      }
      const payload = normalizeAiPayload(parsed);
      await saveAdminAiContent({ productId, aiStatus: "generated", ...payload, aiError: null, aiGeneratedAt: new Date().toISOString() });
      return { success: true, status: "generated" as const, raw, attempts: attempt + 1 };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Невалиден AI резултат.";
      if (attempt === 2) break;
    }
  }
  {
    const message = lastError || "Неизвестна грешка при AI генерирането.";
    try {
      await db.insert(catalogueProductAiContent).values({ productId, aiStatus: "error", aiError: message, aiGeneratedAt: new Date() }).onDuplicateKeyUpdate({ set: { aiStatus: "error", aiError: message, aiGeneratedAt: new Date() } });
    } catch {
      // Preserve the original generation error for the administrator.
    }
    return { success: false, status: "error" as const, error: message };
  }
}

export type AiBatchStatus = "queued" | "running" | "paused" | "completed" | "failed";

export async function getAdminAiCategories() {
  const db = await database();
  return db.select({ id: catalogueCategories.id, name: catalogueCategories.name }).from(catalogueCategories).where(eq(catalogueCategories.isArchived, false)).orderBy(asc(catalogueCategories.name));
}

export async function getAdminAiProductIds(input?: { status?: AiContentStatus; confidence?: AiContentConfidence; query?: string; categoryId?: number }) {
  const db = await database();
  const conditions = [eq(catalogueProducts.isArchived, false), eq(catalogueCategories.isArchived, false)];
  if (input?.status) conditions.push(eq(catalogueProductAiContent.aiStatus, input.status));
  if (input?.confidence) conditions.push(eq(catalogueProductAiContent.aiConfidence, input.confidence));
  if (input?.categoryId) conditions.push(eq(catalogueProducts.categoryId, input.categoryId));
  const query = input?.query?.trim();
  if (query) conditions.push(or(like(catalogueProducts.name, `%${query}%`), like(catalogueProducts.sku, `%${query}%`), like(catalogueProducts.brand, `%${query}%`))!);
  const rows = await db.select({ id: catalogueProducts.id }).from(catalogueProducts).innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id)).leftJoin(catalogueProductAiContent, eq(catalogueProductAiContent.productId, catalogueProducts.id)).where(and(...conditions)).orderBy(asc(catalogueProducts.name), asc(catalogueProducts.id));
  return rows.map(row => row.id);
}

export async function enqueueAiGeneration(input: { productIds: number[]; createdBy?: number | null }) {
  const db = await database();
  const ids = Array.from(new Set(input.productIds)).slice(0, 10_000);
  if (!ids.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Изберете поне един продукт." });
  const products = await db.select({ id: catalogueProducts.id }).from(catalogueProducts).where(and(inArray(catalogueProducts.id, ids), eq(catalogueProducts.isArchived, false)));
  const validIds = products.map(product => product.id);
  if (!validIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Избраните продукти не са налични за обработка." });
  const created = await db.insert(aiGenerationBatches).values({ totalJobs: validIds.length, createdBy: input.createdBy ?? null });
  const batchId = Number((created as unknown as Array<{ insertId: number }>)[0]?.insertId);
  if (!batchId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Опашката не можа да бъде създадена." });
  await db.insert(aiGenerationJobs).values(validIds.map(productId => ({ batchId, productId, nextAttemptAt: new Date() })));
  return { batchId, total: validIds.length } as const;
}

export async function getAdminAiQueueStatus(batchId?: number) {
  const db = await database();
  const [batch] = await db.select().from(aiGenerationBatches).where(batchId ? eq(aiGenerationBatches.id, batchId) : undefined).orderBy(desc(aiGenerationBatches.id)).limit(1);
  if (!batch) return null;
  const grouped = await db.select({ status: aiGenerationJobs.status, total: count() }).from(aiGenerationJobs).where(eq(aiGenerationJobs.batchId, batch.id)).groupBy(aiGenerationJobs.status);
  const progress = { queued: 0, running: 0, succeeded: 0, failed: 0 };
  for (const row of grouped) progress[row.status as keyof typeof progress] = Number(row.total ?? 0);
  const usageDate = new Date().toISOString().slice(0, 10);
  const [usage, settings] = await Promise.all([
    db.select().from(aiGenerationDailyUsage).where(eq(aiGenerationDailyUsage.usageDate, usageDate)).limit(1),
    db.select({ dailyGenerationLimit: aiContentSettings.dailyGenerationLimit }).from(aiContentSettings).where(eq(aiContentSettings.id, 1)).limit(1),
  ]);
  return { batchId: batch.id, status: batch.status as AiBatchStatus, total: batch.totalJobs, progress, createdAt: batch.createdAt, startedAt: batch.startedAt, finishedAt: batch.finishedAt, dailyUsed: usage[0]?.generatedCount ?? 0, dailyLimit: settings[0]?.dailyGenerationLimit ?? 0 };
}

export async function setAdminAiQueueStatus(batchId: number, status: "paused" | "queued") {
  const db = await database();
  const [batch] = await db.select({ id: aiGenerationBatches.id, status: aiGenerationBatches.status }).from(aiGenerationBatches).where(eq(aiGenerationBatches.id, batchId)).limit(1);
  if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "AI опашката не е намерена." });
  if (status === "paused" && !["queued", "running"].includes(batch.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "Тази опашка вече е приключила." });
  if (status === "queued" && batch.status !== "paused") throw new TRPCError({ code: "BAD_REQUEST", message: "Само паузирана опашка може да бъде продължена." });
  await db.update(aiGenerationBatches).set({ status, startedAt: status === "queued" ? new Date() : undefined }).where(eq(aiGenerationBatches.id, batchId));
  return getAdminAiQueueStatus(batchId);
}

let queueWorkerStarted = false;
let queueWorkerBusy = false;

async function finalizeBatch(db: Awaited<ReturnType<typeof database>>, batchId: number) {
  const grouped = await db.select({ status: aiGenerationJobs.status, total: count() }).from(aiGenerationJobs).where(eq(aiGenerationJobs.batchId, batchId)).groupBy(aiGenerationJobs.status);
  const counts = new Map(grouped.map(row => [row.status, Number(row.total ?? 0)]));
  if ((counts.get("queued") ?? 0) === 0 && (counts.get("running") ?? 0) === 0) {
    const status = (counts.get("failed") ?? 0) > 0 ? "failed" as const : "completed" as const;
    await db.update(aiGenerationBatches).set({ status, finishedAt: new Date() }).where(and(eq(aiGenerationBatches.id, batchId), inArray(aiGenerationBatches.status, ["queued", "running"])));
  }
}

async function processAiQueueOnce() {
  if (queueWorkerBusy) return;
  queueWorkerBusy = true;
  try {
    const db = await database();
    const batches = await db.select({ id: aiGenerationBatches.id }).from(aiGenerationBatches).where(inArray(aiGenerationBatches.status, ["queued", "running"])).orderBy(asc(aiGenerationBatches.id)).limit(10);
    for (const batch of batches) {
      await db.update(aiGenerationBatches).set({ status: "running", startedAt: sql`COALESCE(${aiGenerationBatches.startedAt}, NOW())` }).where(and(eq(aiGenerationBatches.id, batch.id), eq(aiGenerationBatches.status, "queued")));
      const jobs = await db.select({ id: aiGenerationJobs.id, productId: aiGenerationJobs.productId, attempts: aiGenerationJobs.attempts, maxAttempts: aiGenerationJobs.maxAttempts }).from(aiGenerationJobs).where(and(eq(aiGenerationJobs.batchId, batch.id), eq(aiGenerationJobs.status, "queued"), or(isNull(aiGenerationJobs.nextAttemptAt), lte(aiGenerationJobs.nextAttemptAt, new Date()))!)).orderBy(asc(aiGenerationJobs.id)).limit(5);
      if (!jobs.length) { await finalizeBatch(db, batch.id); continue; }
      await Promise.all(jobs.map(async job => {
        await db.update(aiGenerationJobs).set({ status: "running", startedAt: new Date(), attempts: job.attempts + 1 }).where(and(eq(aiGenerationJobs.id, job.id), eq(aiGenerationJobs.status, "queued")));
        try {
          const result = await generateAdminAiContent(job.productId);
          if (result.status === "generated") await db.update(aiGenerationJobs).set({ status: "succeeded", completedAt: new Date(), lastError: null }).where(eq(aiGenerationJobs.id, job.id));
          else {
            const error = result.error || "AI генерирането неуспешно.";
            if (error.includes("Дневният лимит")) {
              const tomorrow = new Date(); tomorrow.setUTCHours(24, 0, 0, 0);
              await db.update(aiGenerationJobs).set({ status: "queued", nextAttemptAt: tomorrow, lastError: error }).where(eq(aiGenerationJobs.id, job.id));
            } else if (job.attempts + 1 < job.maxAttempts) {
              await db.update(aiGenerationJobs).set({ status: "queued", nextAttemptAt: new Date(Date.now() + Math.min(60 * 60_000, 2 ** job.attempts * 30_000)), lastError: error }).where(eq(aiGenerationJobs.id, job.id));
            } else await db.update(aiGenerationJobs).set({ status: "failed", completedAt: new Date(), lastError: error }).where(eq(aiGenerationJobs.id, job.id));
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Неизвестна грешка в AI worker-а.";
          if (job.attempts < job.maxAttempts) await db.update(aiGenerationJobs).set({ status: "queued", nextAttemptAt: new Date(Date.now() + Math.min(60 * 60_000, 2 ** job.attempts * 30_000)), lastError: message }).where(eq(aiGenerationJobs.id, job.id));
          else await db.update(aiGenerationJobs).set({ status: "failed", completedAt: new Date(), lastError: message }).where(eq(aiGenerationJobs.id, job.id));
        }
      }));
      await finalizeBatch(db, batch.id);
    }
  } catch (error) { console.error("[AI queue]", error); }
  finally { queueWorkerBusy = false; }
}

export function startAiGenerationWorker() {
  if (queueWorkerStarted) return;
  queueWorkerStarted = true;
  void processAiQueueOnce();
  setInterval(() => void processAiQueueOnce(), 5_000).unref();
}

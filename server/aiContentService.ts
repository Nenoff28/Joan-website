import { and, asc, count, desc, eq, exists, gt, inArray, isNull, like, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { aiContentSettings, aiGenerationBatches, aiGenerationDailyUsage, aiGenerationJobs, catalogueProductAiBackups, catalogueProductAiContent, catalogueCategories, catalogueProductCategoryLinks, catalogueProducts } from "../drizzle/schema";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import { legacyCategoryRootsByPublicSlug } from "./productCategoryAssignments";

export type AiContentStatus = "pending" | "generated" | "reviewed" | "published" | "error";
export type AiContentConfidence = "high" | "low";
export type AiAvailabilityFilter = "all" | "in_stock" | "not_in_stock";
export type AiVisibilityFilter = "all" | "visible" | "hidden";
export type AiContentSort = "confidence-low" | "name-asc" | "name-desc" | "stock-desc" | "stock-asc" | "updated-desc" | "updated-asc";

const FREE_AI_PROVIDER = "manus";
const FREE_AI_MODEL = "gpt-5-mini";
const OFFLINE_AI_INSTRUCTION = `

ВАЖНО ЗА ТЕКУЩИЯ РЕЖИМ: Работиш напълно без Google Search, Gemini и външни заявки. Не проучвай интернет и не твърди, че си го направил. Използвай всички подадени данни за продукта. Не съкращавай техническата информация: пренеси всяка налична характеристика като отделен елемент във features във формат "Параметър: стойност", а в description обясни подробно продукта и приложението му. Можеш да преформулираш само за по-добра четливост; не измисляй липсващи технически факти, размери, мощности, материали или сертификати. Ако данните са малко, бъди точен, но не добавяй фиктивни параметри. Отговори САМО с един валиден JSON обект без markdown, обяснение или текст преди/след него със следните полета: description (подробен непразен низ), features (масив от низове, може да е празен само ако няма никакви технически данни), seo_title, seo_description, keywords, source_urls (празен масив), confidence (точно "висока" или "ниска").`;

async function database() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Базата данни временно не е достъпна." });
  return db;
}

type AiCategoryRow = Pick<typeof catalogueCategories.$inferSelect, "id" | "name" | "slug" | "legacyCategoryId" | "legacyParentCategoryId" | "parentId" | "sortOrder" | "isActive" | "isArchived">;

function categoryParentId(row: AiCategoryRow, rows: AiCategoryRow[]) {
  if (row.parentId != null) return row.parentId;
  const publicRoot = rows.find(candidate => candidate.legacyCategoryId == null && candidate.slug && (legacyCategoryRootsByPublicSlug[candidate.slug] ?? []).includes(row.legacyCategoryId ?? row.legacyParentCategoryId ?? -1));
  if (publicRoot) return publicRoot.id;
  if (row.legacyParentCategoryId == null) return null;
  const legacyParent = rows.find(candidate => candidate.legacyCategoryId === row.legacyParentCategoryId);
  if (legacyParent) return legacyParent.id;
  return null;
}

async function getCategoryRows(db: Awaited<ReturnType<typeof database>>) {
  return db.select({ id: catalogueCategories.id, name: catalogueCategories.name, slug: catalogueCategories.slug, legacyCategoryId: catalogueCategories.legacyCategoryId, legacyParentCategoryId: catalogueCategories.legacyParentCategoryId, parentId: catalogueCategories.parentId, sortOrder: catalogueCategories.sortOrder, isActive: catalogueCategories.isActive, isArchived: catalogueCategories.isArchived }).from(catalogueCategories).where(eq(catalogueCategories.isArchived, false));
}

function descendantCategoryIds(selectedId: number, rows: AiCategoryRow[]) {
  const ids = new Set<number>([selectedId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows) {
      const parentId = categoryParentId(row, rows);
      if (!ids.has(row.id) && parentId != null && ids.has(parentId)) {
        ids.add(row.id);
        changed = true;
      }
    }
  }
  return Array.from(ids);
}

function flattenCategoryOptions(rows: AiCategoryRow[], counts = new Map<number, number>()) {
  const children = new Map<number | null, AiCategoryRow[]>();
  for (const row of rows.filter(item => (item.isActive || item.legacyCategoryId != null) && !item.isArchived)) {
    const parentId = categoryParentId(row, rows);
    const current = children.get(parentId) ?? [];
    current.push(row);
    children.set(parentId, current);
  }
  const result: Array<{ id: number; name: string; count: number }> = [];
  const visit = (parentId: number | null, depth: number) => {
    const siblings = (children.get(parentId) ?? []).sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "bg") || left.id - right.id);
    for (const row of siblings) {
      result.push({ id: row.id, name: `${depth ? `${"— ".repeat(depth)}` : ""}${row.name}`, count: counts.get(row.id) ?? 0 });
      visit(row.id, depth + 1);
    }
  };
  visit(null, 0);
  return result;
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
    availability: row.product.availability,
    stockQuantity: row.product.stockQuantity,
    aiStatus: row.ai?.aiStatus ?? "pending",
    aiProvider: row.ai?.aiProvider ?? null,
    aiModel: row.ai?.aiModel ?? null,
    aiDescription: row.ai?.aiDescription ?? null,
    aiFeatures: row.ai?.aiFeatures ?? null,
    aiSeoTitle: row.ai?.aiSeoTitle ?? null,
    aiSeoDescription: row.ai?.aiSeoDescription ?? null,
    aiKeywords: row.ai?.aiKeywords ?? null,
    aiSourceUrls: parseSourceUrls(row.ai?.aiSourceUrls ?? null),
    aiConfidence: row.ai?.aiConfidence ?? null,
    aiError: row.ai?.aiError ?? null,
    aiGeneratedAt: row.ai?.aiGeneratedAt ?? null,
    aiInputTokens: row.ai?.aiInputTokens ?? null,
    aiOutputTokens: row.ai?.aiOutputTokens ?? null,
    aiSearchCount: row.ai?.aiSearchCount ?? 0,
    canRestore: Boolean(row.backup && !row.backup.restoredAt),
  };
}

export async function getAdminAiContent(input?: { status?: AiContentStatus; confidence?: AiContentConfidence; query?: string; categoryId?: number; availability?: AiAvailabilityFilter; visibility?: AiVisibilityFilter; sort?: AiContentSort; page?: number; pageSize?: number }) {
  const db = await database();
  const page = input?.page ?? 1;
  const pageSize = input?.pageSize ?? 50;
  const categoryRows = input?.categoryId ? await getCategoryRows(db) : [];
  const categoryIds = input?.categoryId ? descendantCategoryIds(input.categoryId, categoryRows) : [];
  const conditions = [eq(catalogueProducts.isArchived, false), eq(catalogueCategories.isArchived, false)];
  if (input?.status) conditions.push(eq(catalogueProductAiContent.aiStatus, input.status));
  if (input?.confidence) conditions.push(eq(catalogueProductAiContent.aiConfidence, input.confidence));
  if (input?.categoryId) conditions.push(or(
    inArray(catalogueProducts.categoryId, categoryIds),
    exists(db.select({ one: sql`1` }).from(catalogueProductCategoryLinks).where(and(eq(catalogueProductCategoryLinks.productId, catalogueProducts.id), inArray(catalogueProductCategoryLinks.categoryId, categoryIds)))),
  )!);
  if (input?.availability === "in_stock") conditions.push(gt(catalogueProducts.stockQuantity, 0));
  if (input?.availability === "not_in_stock") conditions.push(lte(catalogueProducts.stockQuantity, 0));
  if (input?.visibility === "visible") conditions.push(eq(catalogueProducts.isActive, true));
  if (input?.visibility === "hidden") conditions.push(eq(catalogueProducts.isActive, false));
  const query = input?.query?.trim();
  if (query) conditions.push(or(like(catalogueProducts.name, `%${query}%`), like(catalogueProducts.sku, `%${query}%`), like(catalogueProducts.brand, `%${query}%`))!);
  const ordering: SQL[] = input?.sort === "name-asc"
    ? [asc(catalogueProducts.name), asc(catalogueProducts.id)]
    : input?.sort === "name-desc"
      ? [desc(catalogueProducts.name), asc(catalogueProducts.id)]
      : input?.sort === "stock-desc"
        ? [desc(catalogueProducts.stockQuantity), asc(catalogueProducts.name), asc(catalogueProducts.id)]
        : input?.sort === "stock-asc"
          ? [asc(catalogueProducts.stockQuantity), asc(catalogueProducts.name), asc(catalogueProducts.id)]
          : input?.sort === "updated-desc"
            ? [desc(catalogueProductAiContent.updatedAt), asc(catalogueProducts.name), asc(catalogueProducts.id)]
            : input?.sort === "updated-asc"
              ? [asc(catalogueProductAiContent.updatedAt), asc(catalogueProducts.name), asc(catalogueProducts.id)]
              : [desc(sql`CASE WHEN ${catalogueProductAiContent.aiConfidence} = 'low' THEN 1 ELSE 0 END`), asc(catalogueProducts.name), asc(catalogueProducts.id)];

  const [rows, totals, statusCounts] = await Promise.all([
    db.select({ product: catalogueProducts, category: catalogueCategories, ai: catalogueProductAiContent, backup: catalogueProductAiBackups })
      .from(catalogueProducts)
      .innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id))
      .leftJoin(catalogueProductAiContent, eq(catalogueProductAiContent.productId, catalogueProducts.id))
      .leftJoin(catalogueProductAiBackups, eq(catalogueProductAiBackups.productId, catalogueProducts.id))
      .where(and(...conditions))
      .orderBy(...ordering)
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
  aiProvider?: string | null;
  aiModel?: string | null;
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
  aiInputTokens?: number | null;
  aiOutputTokens?: number | null;
  aiSearchCount?: number | null;
}) {
  const db = await database();
  const [product] = await db.select({ id: catalogueProducts.id }).from(catalogueProducts).where(eq(catalogueProducts.id, input.productId)).limit(1);
  if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Продуктът не е намерен." });
  const values: typeof catalogueProductAiContent.$inferInsert = {
    productId: input.productId,
    aiStatus: input.aiStatus,
    aiDescription: input.aiDescription?.trim() || null,
    aiFeatures: input.aiFeatures?.trim() || null,
    aiSeoTitle: input.aiSeoTitle?.trim() || null,
    aiSeoDescription: input.aiSeoDescription?.trim() || null,
    aiKeywords: input.aiKeywords?.trim() || null,
    aiConfidence: input.aiConfidence ?? null,
    aiError: input.aiError?.trim() || null,
    ...(input.aiSourceUrls !== undefined ? { aiSourceUrls: JSON.stringify(input.aiSourceUrls) } : {}),
    ...(input.aiGeneratedAt !== undefined ? { aiGeneratedAt: input.aiGeneratedAt ? new Date(input.aiGeneratedAt) : null } : {}),
    ...(input.aiProvider !== undefined ? { aiProvider: input.aiProvider?.trim() || null } : {}),
    ...(input.aiModel !== undefined ? { aiModel: input.aiModel?.trim() || null } : {}),
    ...(input.aiInputTokens !== undefined ? { aiInputTokens: input.aiInputTokens ?? null } : {}),
    ...(input.aiOutputTokens !== undefined ? { aiOutputTokens: input.aiOutputTokens ?? null } : {}),
    ...(input.aiSearchCount !== undefined ? { aiSearchCount: input.aiSearchCount ?? 0 } : {}),
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

export async function reviewAdminAiContentBatch(productIds: number[], action: "approve" | "reject") {
  const db = await database();
  const ids = Array.from(new Set(productIds)).slice(0, 10_000);
  if (!ids.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Изберете поне един продукт за преглед." });
  const nextStatus = action === "approve" ? "reviewed" as const : "pending" as const;
  const eligibleStatuses = action === "approve" ? ["generated", "reviewed"] as const : ["generated", "reviewed", "error"] as const;
  const rows = await db.select({ productId: catalogueProductAiContent.productId }).from(catalogueProductAiContent).where(and(inArray(catalogueProductAiContent.productId, ids), inArray(catalogueProductAiContent.aiStatus, eligibleStatuses)));
  const eligible = rows.map(row => row.productId);
  const eligibleSet = new Set(eligible);
  const skipped = ids.filter(id => !eligibleSet.has(id));
  if (eligible.length) await db.update(catalogueProductAiContent).set({ aiStatus: nextStatus, aiError: null }).where(inArray(catalogueProductAiContent.productId, eligible));
  return { success: true, aiStatus: nextStatus, reviewed: eligible.length, skipped } as const;
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
  return { systemPrompt: settings.systemPrompt, model: FREE_AI_MODEL, dailyGenerationLimit: 0, updatedAt: settings.updatedAt, provider: FREE_AI_PROVIDER, freeMode: true, googleSearch: false };
}

export async function saveAdminAiSettings(systemPrompt: string, model: string, dailyGenerationLimit: number) {
  const prompt = systemPrompt.trim();
  if (prompt.length < 20) throw new TRPCError({ code: "BAD_REQUEST", message: "Системният prompt трябва да съдържа поне 20 знака." });
  if (prompt.length > 100_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Системният prompt е прекалено дълъг." });
  const db = await database();
  await db.insert(aiContentSettings).values({ id: 1, systemPrompt: prompt, model: FREE_AI_MODEL, dailyGenerationLimit: 0 }).onDuplicateKeyUpdate({ set: { systemPrompt: prompt, model: FREE_AI_MODEL, dailyGenerationLimit: 0 } });
  return { success: true, systemPrompt: prompt, model: FREE_AI_MODEL, dailyGenerationLimit: 0, provider: FREE_AI_PROVIDER, freeMode: true, googleSearch: false } as const;
}

function llmResponseText(content: unknown) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.filter((part): part is { type: "text"; text: string } => Boolean(part && typeof part === "object" && (part as { type?: unknown }).type === "text" && typeof (part as { text?: unknown }).text === "string")).map(part => part.text).join("\n");
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
}

type FreeAiUsage = { inputTokens: number; outputTokens: number; searchCount: number };

export async function checkFreeAiConnection() {
  try {
    const result = await invokeLLM({ model: FREE_AI_MODEL, maxTokens: 128, messages: [{ role: "system", content: "Отговори само с OK." }, { role: "user", content: "Провери, че вграденият безплатен AI режим работи." }] });
    const text = llmResponseText(result.choices[0]?.message.content).trim();
    return { ok: true, status: 200, message: text.slice(0, 200) || "OK", model: FREE_AI_MODEL, provider: FREE_AI_PROVIDER, googleSearch: false, usage: { inputTokens: result.usage?.prompt_tokens ?? 0, outputTokens: result.usage?.completion_tokens ?? 0, searchCount: 0 } };
  } catch (error) {
    return { ok: false, status: 500, message: error instanceof Error ? error.message : "Вграденият AI режим не отговори.", model: FREE_AI_MODEL, provider: FREE_AI_PROVIDER, googleSearch: false };
  }
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

export function validateAiPayload(payload: Record<string, unknown>, options: { requireSourceUrls?: boolean } = {}): string[] {
  const errors: string[] = [];
  const features = payload.features;
  const sourceUrls = payload.source_urls;
  if (!textField(payload.description)) errors.push("description трябва да е непразен текст");
  if (typeof payload.seo_title !== "string" || payload.seo_title.trim().length > 60) errors.push("seo_title трябва да е до 60 знака");
  if (typeof payload.seo_description !== "string" || payload.seo_description.trim().length > 200) errors.push("seo_description трябва да е до 200 знака");
  if (typeof payload.keywords !== "string" || payload.keywords.trim().length > 255) errors.push("keywords трябва да е до 255 знака");
  if (!Array.isArray(features) || features.some(item => typeof item !== "string" || !item.trim())) errors.push("features трябва да е масив от низове; празен масив е допустим");
  if (typeof payload.confidence !== "string" || !["висока", "ниска"].includes(payload.confidence.trim().toLowerCase())) errors.push('confidence трябва да е „висока“ или „ниска“');
  if (!Array.isArray(sourceUrls) || (options.requireSourceUrls && sourceUrls.length === 0) || sourceUrls.some(item => typeof item !== "string" || !/^https?:\/\//i.test(item))) errors.push("source_urls трябва да съдържа поне един валиден URL");
  const searchableText = [payload.description, payload.seo_title, payload.seo_description, payload.keywords, ...(Array.isArray(features) ? features : [])].filter((value): value is string => typeof value === "string").join(" ").toLowerCase();
  if (/няма информация|не е налично|не е налична|няма данни|неизвестно/.test(searchableText)) errors.push("съдържанието не трябва да съдържа фрази без информационна стойност");
  return errors;
}

function normalizedComparison(value: string) {
  return value.toLowerCase().replace(/[\s:;,.\-–—/()]+/g, "").trim();
}

function mergeSourceText(generated: string, source: string) {
  const generatedText = generated.trim();
  const sourceText = source.trim();
  if (!sourceText || !generatedText) return generatedText || sourceText;
  if (generatedText.includes(sourceText)) return generatedText;
  if (generatedText.length >= sourceText.length * 0.75) return generatedText;
  return `${generatedText}\n\n${sourceText}`;
}

function mergeSourceFeatures(generated: string, source: string) {
  const generatedLines = generated.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
  const sourceLines = source.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
  const comparisons = generatedLines.map(normalizedComparison);
  for (const sourceLine of sourceLines) {
    const normalized = normalizedComparison(sourceLine);
    if (normalized.length > 0 && !comparisons.some(item => item.includes(normalized) || normalized.includes(item))) {
      generatedLines.push(sourceLine);
      comparisons.push(normalized);
    }
  }
  return generatedLines.join("\n");
}

function buildAuthoritativeFeatures(categoryName: string | null, rawFeatures: string) {
  const sourceLines = rawFeatures.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
  const withoutGeneratedIdentity = sourceLines.filter(line => {
    const label = line.split(":", 1)[0]?.trim().toLowerCase();
    return label !== "модел" && label !== "model" && label !== "вътрешен код" && label !== "internal code" && label !== "категория" && label !== "category";
  });
  const category = categoryName?.trim() ? [`Категория: ${categoryName.trim()}`] : [];
  return [...withoutGeneratedIdentity, ...category].join("\n");
}

function extractLegacyDescriptionFeatures(value: string) {
  const output: string[] = [];
  const add = (label: string, result: string, unit = "") => {
    const cleanResult = result.replace(/\s+/g, " ").trim();
    if (cleanResult) output.push(`${label}: ${cleanResult}${unit}`.trim());
  };
  for (const rawLine of value.replace(/<br\s*\/?>(?=.)/gi, "\n").split(/\n+/)) {
    const line = rawLine.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!line) continue;
    let match: RegExpMatchArray | null;
    if ((match = line.match(/^Номинална\s+Мощност\s*\[([^\]]+)\]\s*(.+)$/i))) add("Номинална мощност", match[2], ` ${match[1]}`);
    else if ((match = line.match(/^Номинално\s+налягане\s*\[([^\]]+)\]\s*(.+)$/i))) add("Номинално налягане", match[2], ` ${match[1]}`);
    else if ((match = line.match(/^Площ на топлообменниците\s*\[([^\]]+)\]\s*(.+)$/i))) add("Площ на топлообменниците", match[2], ` ${match[1]}`);
    else if ((match = line.match(/^Топлинни загуби[^\[]*\[([^\]]+)\]\s*(.+)$/i))) add("Топлинни загуби при нулев товар", match[2], ` ${match[1]}`);
    else if ((match = line.match(/^Габаритни размери\s+[^\[]*\[([^\]]+)\]\s*(.+)$/i))) add("Габаритни размери", match[2], ` ${match[1]}`);
    else if ((match = line.match(/^Тегло\s*\[([^\]]+)\]\s*(.+)$/i))) add("Тегло", match[2], ` ${match[1]}`);
    else if ((match = line.match(/^Монтаж\s+(.+)$/i))) add("Монтаж", match[1]);
    else if ((match = line.match(/^Водосъдържател\s+(.+)$/i))) add("Водосъдържател", match[1]);
    else if ((match = line.match(/^Обемна група\s+(.+)$/i))) add("Номинален обем", match[1], /^\d+(?:[.,]\d+)?$/.test(match[1].trim()) ? " л" : "");
    else if ((match = line.match(/^Начин на загряване на водата\s+(.+)$/i))) add("Начин на загряване", match[1]);
    else if ((match = line.match(/^Управление\s+с\s+(.+)$/i))) add("Управление", match[1].replace(/\s+управление$/i, ""));
    else if ((match = line.match(/^Клас на енергийна ефективност\s+(.+)$/i))) add("Клас на енергийна ефективност", match[1]);
    else if (/^[^:]+:\s*.+$/.test(line)) output.push(line);
  }
  if (output.some(item => /Начин на загряване:.*топлообменник/i.test(item)) && !output.some(item => /^Тип:/i.test(item))) output.splice(1, 0, "Тип: Комбиниран бойлер");
  return output.join("\n");
}

function normalizeAiPayload(payload: Record<string, unknown>, sourceDescription = "", sourceFeatures = "") {
  const confidence = textField(payload.confidence).toLowerCase();
  const generatedDescription = textField(payload.description);
  const generatedFeatures = Array.isArray(payload.features) ? payload.features.filter((item): item is string => typeof item === "string" && item.trim().length > 0).join("\n") : "";
  return {
    aiDescription: mergeSourceText(generatedDescription, sourceDescription) || null,
    // Technical data is authoritative catalogue data. Never let the model
    // replace a source value with a guessed capacity, model or power rating.
    aiFeatures: sourceFeatures.trim() || mergeSourceFeatures(generatedFeatures, sourceFeatures) || null,
    aiSeoTitle: textField(payload.seo_title) || null,
    aiSeoDescription: textField(payload.seo_description) || null,
    aiKeywords: textField(payload.keywords) || null,
    aiSourceUrls: Array.isArray(payload.source_urls) ? payload.source_urls.filter((item): item is string => typeof item === "string" && /^https?:\/\//i.test(item)) : [],
    aiConfidence: confidence === "висока" || confidence === "high" ? "high" as const : "low" as const,
  };
}

async function reserveDailyGeneration(db: Awaited<ReturnType<typeof database>>, limit: number) {
  // Quota is disabled for the current rollout. The counter remains available
  // for reporting and can be reactivated later without changing the worker.
  void db;
  void limit;
  return true;
  /*
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
  */
}

export async function generateAdminAiContent(productId: number, options?: { skipQuota?: boolean }) {
  const db = await database();
  const [product] = await db.select({ id: catalogueProducts.id, name: catalogueProducts.name, brand: catalogueProducts.brand, sku: catalogueProducts.sku, description: catalogueProducts.description, featuresJson: catalogueProducts.featuresJson, backupDescription: catalogueProductAiBackups.description, backupFeaturesJson: catalogueProductAiBackups.featuresJson, categoryName: catalogueCategories.name }).from(catalogueProducts).innerJoin(catalogueCategories, eq(catalogueCategories.id, catalogueProducts.categoryId)).leftJoin(catalogueProductAiBackups, eq(catalogueProductAiBackups.productId, catalogueProducts.id)).where(eq(catalogueProducts.id, productId)).limit(1);
  if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Продуктът не е намерен." });
  const [settings] = await db.select().from(aiContentSettings).where(eq(aiContentSettings.id, 1)).limit(1);
  if (!settings) throw new TRPCError({ code: "NOT_FOUND", message: "AI системният prompt не е настроен." });
  if (!options?.skipQuota && !(await reserveDailyGeneration(db, settings.dailyGenerationLimit))) {
    const message = "Дневният лимит за AI генерирания е достигнат.";
    await db.insert(catalogueProductAiContent).values({ productId, aiStatus: "error", aiError: message, aiGeneratedAt: new Date() }).onDuplicateKeyUpdate({ set: { aiStatus: "error", aiError: message, aiGeneratedAt: new Date() } });
    return { success: false, status: "error" as const, error: message };
  }

  const model = FREE_AI_MODEL;
  const rawSourceDescription = product.backupDescription || product.description || "";
  const sourceDescription = stripHtml(rawSourceDescription);
  const descriptionFeatures = extractLegacyDescriptionFeatures(rawSourceDescription);
  const sourceFeatures = buildAuthoritativeFeatures(product.categoryName, [formatLegacyFeatures(product.backupFeaturesJson || product.featuresJson || ""), descriptionFeatures].filter(Boolean).join("\n"));
  const productInput = `ДАННИ ОТ КАТАЛОГА (единственият разрешен източник на факти):
Категория: ${product.categoryName || "няма посочена"}
Марка: ${product.brand || "няма посочена"}
Име на продукта: ${product.name}
EAN/артикулен номер: ${product.sku || "няма посочен"}
Съществуващо описание:
${sourceDescription || "няма въведено описание"}
Съществуващи технически данни:
${sourceFeatures || "няма въведени технически данни"}`;
  let lastError = "AI резултатът не премина програмната проверка.";
  const totalUsage: FreeAiUsage = { inputTokens: 0, outputTokens: 0, searchCount: 0 };
  for (let attempt = 0; attempt <= 2; attempt += 1) {
    try {
      const correction = attempt === 0 ? "" : `\n\nПредишният отговор не премина програмната проверка: ${lastError}\nВърни отново само коригиран валиден JSON обект, като спазиш всички ограничения за дължини и типове.`;
      const response = await invokeLLM({ model, maxTokens: 4096, messages: [{ role: "system", content: settings.systemPrompt + OFFLINE_AI_INSTRUCTION }, { role: "user", content: productInput + correction }] });
      totalUsage.inputTokens += response.usage?.prompt_tokens ?? 0;
      totalUsage.outputTokens += response.usage?.completion_tokens ?? 0;
      const raw = llmResponseText(response.choices[0]?.message.content).trim();
      const parsed = parseAiJsonObject(raw);
      const validationErrors = validateAiPayload(parsed);
      if (validationErrors.length > 0) {
        lastError = validationErrors.join("; ");
        continue;
      }
      const payload = normalizeAiPayload(parsed, sourceDescription, sourceFeatures);
      await saveAdminAiContent({ productId, aiProvider: FREE_AI_PROVIDER, aiModel: model, aiStatus: "generated", ...payload, aiError: null, aiGeneratedAt: new Date().toISOString(), aiInputTokens: totalUsage.inputTokens, aiOutputTokens: totalUsage.outputTokens, aiSearchCount: totalUsage.searchCount });
      return { success: true, status: "generated" as const, raw, attempts: attempt + 1, usage: totalUsage };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Невалиден AI резултат.";
      const typed = error as Error & { status?: number; retryable?: boolean };
      if (typed.status === 401 || typed.status === 403 || typed.status === 429 || typed.retryable === false) break;
      if (attempt === 2) break;
    }
  }
  {
    const message = lastError || "Неизвестна грешка при AI генерирането.";
    try {
      await db.insert(catalogueProductAiContent).values({ productId, aiProvider: FREE_AI_PROVIDER, aiModel: model, aiStatus: "error", aiError: message, aiGeneratedAt: new Date(), aiInputTokens: totalUsage.inputTokens, aiOutputTokens: totalUsage.outputTokens, aiSearchCount: totalUsage.searchCount }).onDuplicateKeyUpdate({ set: { aiProvider: FREE_AI_PROVIDER, aiModel: model, aiStatus: "error", aiError: message, aiGeneratedAt: new Date(), aiInputTokens: totalUsage.inputTokens, aiOutputTokens: totalUsage.outputTokens, aiSearchCount: totalUsage.searchCount } });
    } catch {
      // Preserve the original generation error for the administrator.
    }
    return { success: false, status: "error" as const, error: message };
  }
}

export type AiBatchStatus = "queued" | "running" | "paused" | "completed" | "failed";

export async function getAdminAiCategories(input?: { status?: AiContentStatus; confidence?: AiContentConfidence; query?: string; availability?: AiAvailabilityFilter; visibility?: AiVisibilityFilter }) {
  const db = await database();
  const rows = await getCategoryRows(db);
  const productIds = await getAdminAiProductIds(input);
  const counts = new Map<number, number>();
  if (productIds.length) {
    const primaryRows = await db.select({ productId: catalogueProducts.id, categoryId: catalogueProducts.categoryId }).from(catalogueProducts).where(inArray(catalogueProducts.id, productIds));
    const linkedRows = await db.select({ productId: catalogueProductCategoryLinks.productId, categoryId: catalogueProductCategoryLinks.categoryId }).from(catalogueProductCategoryLinks).where(inArray(catalogueProductCategoryLinks.productId, productIds));
    const assignments = new Map<number, number[]>();
    for (const row of primaryRows) assignments.set(row.productId, [...(assignments.get(row.productId) ?? []), row.categoryId]);
    for (const row of linkedRows) assignments.set(row.productId, [...(assignments.get(row.productId) ?? []), row.categoryId]);
    for (const productCategoryIds of Array.from(assignments.values())) {
      const countedForProduct = new Set<number>();
      for (const assignedId of productCategoryIds) {
        let currentId: number | null = assignedId;
        while (currentId != null && !countedForProduct.has(currentId)) {
          countedForProduct.add(currentId);
          currentId = categoryParentId(rows.find(row => row.id === currentId)!, rows);
        }
      }
      for (const categoryId of Array.from(countedForProduct)) counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
    }
  }
  return flattenCategoryOptions(rows, counts);
}

export async function getAdminAiProductIds(input?: { status?: AiContentStatus; confidence?: AiContentConfidence; query?: string; categoryId?: number; availability?: AiAvailabilityFilter; visibility?: AiVisibilityFilter }) {
  const db = await database();
  const categoryRows = input?.categoryId ? await getCategoryRows(db) : [];
  const categoryIds = input?.categoryId ? descendantCategoryIds(input.categoryId, categoryRows) : [];
  const conditions = [eq(catalogueProducts.isArchived, false), eq(catalogueCategories.isArchived, false)];
  if (input?.status) conditions.push(eq(catalogueProductAiContent.aiStatus, input.status));
  if (input?.confidence) conditions.push(eq(catalogueProductAiContent.aiConfidence, input.confidence));
  if (input?.categoryId) conditions.push(or(
    inArray(catalogueProducts.categoryId, categoryIds),
    exists(db.select({ one: sql`1` }).from(catalogueProductCategoryLinks).where(and(eq(catalogueProductCategoryLinks.productId, catalogueProducts.id), inArray(catalogueProductCategoryLinks.categoryId, categoryIds)))),
  )!);
  if (input?.availability === "in_stock") conditions.push(gt(catalogueProducts.stockQuantity, 0));
  if (input?.availability === "not_in_stock") conditions.push(lte(catalogueProducts.stockQuantity, 0));
  if (input?.visibility === "visible") conditions.push(eq(catalogueProducts.isActive, true));
  if (input?.visibility === "hidden") conditions.push(eq(catalogueProducts.isActive, false));
  const query = input?.query?.trim();
  if (query) conditions.push(or(like(catalogueProducts.name, `%${query}%`), like(catalogueProducts.sku, `%${query}%`), like(catalogueProducts.brand, `%${query}%`))!);
  const rows = await db.select({ id: catalogueProducts.id }).from(catalogueProducts).innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id)).leftJoin(catalogueProductAiContent, eq(catalogueProductAiContent.productId, catalogueProducts.id)).where(and(...conditions)).orderBy(asc(catalogueProducts.name), asc(catalogueProducts.id));
  return rows.map(row => row.id);
}

export async function enqueueAiGeneration(input: { productIds: number[]; createdBy?: number | null; autoPublish?: boolean }) {
  const db = await database();
  const ids = Array.from(new Set(input.productIds)).slice(0, 10_000);
  if (!ids.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Изберете поне един продукт." });
  const products = await db.select({ id: catalogueProducts.id }).from(catalogueProducts).where(and(inArray(catalogueProducts.id, ids), eq(catalogueProducts.isArchived, false)));
  const validIds = products.map(product => product.id);
  if (!validIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Избраните продукти не са налични за обработка." });
  const created = await db.insert(aiGenerationBatches).values({ totalJobs: validIds.length, autoPublish: input.autoPublish ?? false, createdBy: input.createdBy ?? null });
  const batchId = Number((created as unknown as Array<{ insertId: number }>)[0]?.insertId);
  if (!batchId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Опашката не можа да бъде създадена." });
  await db.insert(aiGenerationJobs).values(validIds.map(productId => ({ batchId, productId, nextAttemptAt: new Date() })));
  return { batchId, total: validIds.length } as const;
}

export async function getAdminAiQueueStatus(batchId?: number) {
  const db = await database();
  const usageDate = new Date().toISOString().slice(0, 10);
  const [usage] = await Promise.all([
    db.select().from(aiGenerationDailyUsage).where(eq(aiGenerationDailyUsage.usageDate, usageDate)).limit(1),
  ]);
  const batches = await db.select().from(aiGenerationBatches).where(batchId ? eq(aiGenerationBatches.id, batchId) : undefined).orderBy(desc(aiGenerationBatches.id)).limit(batchId ? 1 : 8);
  if (!batches.length) return null;
  const queueRows = await Promise.all(batches.map(async batch => {
    const grouped = await db.select({ status: aiGenerationJobs.status, total: count() }).from(aiGenerationJobs).where(eq(aiGenerationJobs.batchId, batch.id)).groupBy(aiGenerationJobs.status);
    const progress = { queued: 0, running: 0, succeeded: 0, failed: 0 };
    for (const row of grouped) progress[row.status as keyof typeof progress] = Number(row.total ?? 0);
    const processed = progress.succeeded + progress.failed;
    const remaining = Math.max(0, batch.totalJobs - processed);
    const elapsedSeconds = batch.startedAt ? Math.max(0, (Date.now() - new Date(batch.startedAt).getTime()) / 1000) : 0;
    const etaSeconds = processed > 0 && remaining > 0 ? Math.ceil((remaining * elapsedSeconds) / processed) : null;
    return { batchId: batch.id, autoPublish: batch.autoPublish, status: batch.status as AiBatchStatus, total: batch.totalJobs, progress, processed, etaSeconds, createdAt: batch.createdAt, startedAt: batch.startedAt, finishedAt: batch.finishedAt };
  }));
  const current = queueRows[0];
  return { ...current, queues: queueRows, dailyUsed: usage[0]?.generatedCount ?? 0, dailyLimit: null };
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
    const batches = await db.select({ id: aiGenerationBatches.id, autoPublish: aiGenerationBatches.autoPublish }).from(aiGenerationBatches).where(inArray(aiGenerationBatches.status, ["queued", "running"])).orderBy(asc(aiGenerationBatches.id)).limit(10);
    for (const batch of batches) {
      await db.update(aiGenerationBatches).set({ status: "running", startedAt: sql`COALESCE(${aiGenerationBatches.startedAt}, NOW())` }).where(and(eq(aiGenerationBatches.id, batch.id), eq(aiGenerationBatches.status, "queued")));
      const jobs = await db.select({ id: aiGenerationJobs.id, productId: aiGenerationJobs.productId, attempts: aiGenerationJobs.attempts, maxAttempts: aiGenerationJobs.maxAttempts }).from(aiGenerationJobs).where(and(eq(aiGenerationJobs.batchId, batch.id), eq(aiGenerationJobs.status, "queued"), or(isNull(aiGenerationJobs.nextAttemptAt), lte(aiGenerationJobs.nextAttemptAt, new Date()))!)).orderBy(asc(aiGenerationJobs.id)).limit(5);
      if (!jobs.length) { await finalizeBatch(db, batch.id); continue; }
      await Promise.all(jobs.map(async job => {
        await db.update(aiGenerationJobs).set({ status: "running", startedAt: new Date(), attempts: job.attempts + 1 }).where(and(eq(aiGenerationJobs.id, job.id), eq(aiGenerationJobs.status, "queued")));
        try {
          const result = await generateAdminAiContent(job.productId);
          if (result.status === "generated") {
            if (batch.autoPublish) {
              await db.update(catalogueProductAiContent).set({ aiStatus: "reviewed", aiError: null }).where(eq(catalogueProductAiContent.productId, job.productId));
              await publishApprovedAiContent([job.productId]);
            }
            await db.update(aiGenerationJobs).set({ status: "succeeded", completedAt: new Date(), lastError: null }).where(eq(aiGenerationJobs.id, job.id));
          }
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

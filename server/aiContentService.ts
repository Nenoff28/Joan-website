import { and, asc, count, eq, like, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { aiContentSettings, catalogueProductAiContent, catalogueCategories, catalogueProducts } from "../drizzle/schema";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";

export type AiContentStatus = "pending" | "generated" | "reviewed" | "published" | "error";
export type AiContentConfidence = "high" | "low";

const DEFAULT_AI_MODEL = "gpt-6-luna";

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

function mapRow(row: { product: typeof catalogueProducts.$inferSelect; category: typeof catalogueCategories.$inferSelect; ai: typeof catalogueProductAiContent.$inferSelect | null }) {
  return {
    productId: row.product.id,
    name: row.product.name,
    sku: row.product.sku,
    brand: row.product.brand,
    imageUrl: row.product.imageUrl,
    categoryName: row.category.name,
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
  };
}

export async function getAdminAiContent(input?: { status?: AiContentStatus; query?: string; page?: number; pageSize?: number }) {
  const db = await database();
  const page = input?.page ?? 1;
  const pageSize = input?.pageSize ?? 50;
  const conditions = [eq(catalogueProducts.isArchived, false), eq(catalogueCategories.isArchived, false)];
  if (input?.status) conditions.push(eq(catalogueProductAiContent.aiStatus, input.status));
  const query = input?.query?.trim();
  if (query) conditions.push(or(like(catalogueProducts.name, `%${query}%`), like(catalogueProducts.sku, `%${query}%`), like(catalogueProducts.brand, `%${query}%`))!);

  const [rows, totals, statusCounts] = await Promise.all([
    db.select({ product: catalogueProducts, category: catalogueCategories, ai: catalogueProductAiContent })
      .from(catalogueProducts)
      .innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id))
      .leftJoin(catalogueProductAiContent, eq(catalogueProductAiContent.productId, catalogueProducts.id))
      .where(and(...conditions))
      .orderBy(asc(catalogueProducts.name), asc(catalogueProducts.id))
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

export async function getAdminAiSettings() {
  const db = await database();
  const [settings] = await db.select().from(aiContentSettings).where(eq(aiContentSettings.id, 1)).limit(1);
  if (!settings) throw new TRPCError({ code: "NOT_FOUND", message: "AI системният prompt не е настроен." });
  return { systemPrompt: settings.systemPrompt, updatedAt: settings.updatedAt };
}

export async function saveAdminAiSettings(systemPrompt: string) {
  const prompt = systemPrompt.trim();
  if (prompt.length < 20) throw new TRPCError({ code: "BAD_REQUEST", message: "Системният prompt трябва да съдържа поне 20 знака." });
  if (prompt.length > 100_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Системният prompt е прекалено дълъг." });
  const db = await database();
  await db.insert(aiContentSettings).values({ id: 1, systemPrompt: prompt }).onDuplicateKeyUpdate({ set: { systemPrompt: prompt } });
  return { success: true, systemPrompt: prompt } as const;
}

function llmResponseText(content: unknown) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.filter((part): part is { type: "text"; text: string } => Boolean(part && typeof part === "object" && (part as { type?: unknown }).type === "text" && typeof (part as { text?: unknown }).text === "string")).map(part => part.text).join("\n");
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

export async function generateAdminAiContent(productId: number) {
  const db = await database();
  const [product] = await db.select({ id: catalogueProducts.id, name: catalogueProducts.name, brand: catalogueProducts.brand, sku: catalogueProducts.sku }).from(catalogueProducts).where(eq(catalogueProducts.id, productId)).limit(1);
  if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Продуктът не е намерен." });
  const [settings] = await db.select().from(aiContentSettings).where(eq(aiContentSettings.id, 1)).limit(1);
  if (!settings) throw new TRPCError({ code: "NOT_FOUND", message: "AI системният prompt не е настроен." });

  try {
    const response = await invokeLLM({
      model: DEFAULT_AI_MODEL,
      maxTokens: 5000,
      reasoning: { effort: "low" },
      messages: [
        { role: "system", content: settings.systemPrompt },
        { role: "user", content: `Марка: ${product.brand || "няма посочена"}\nИме на продукта: ${product.name}\nEAN/артикулен номер: ${product.sku || "няма посочен"}` },
      ],
    });
    const raw = llmResponseText(response.choices?.[0]?.message?.content);
    const payload = normalizeAiPayload(parseAiJsonObject(raw));
    await saveAdminAiContent({ productId, aiStatus: "generated", ...payload, aiError: null, aiGeneratedAt: new Date().toISOString() });
    return { success: true, status: "generated" as const, raw };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестна грешка при AI генерирането.";
    try {
      await db.insert(catalogueProductAiContent).values({ productId, aiStatus: "error", aiError: message, aiGeneratedAt: new Date() }).onDuplicateKeyUpdate({ set: { aiStatus: "error", aiError: message, aiGeneratedAt: new Date() } });
    } catch {
      // Preserve the original generation error for the administrator.
    }
    return { success: false, status: "error" as const, error: message };
  }
}

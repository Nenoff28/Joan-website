import { and, asc, count, eq, like, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { aiContentSettings, catalogueProductAiContent, catalogueCategories, catalogueProducts } from "../drizzle/schema";
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
  if (!textField(payload.description)) errors.push("description трябва да е непразен текст");
  if (typeof payload.seo_title !== "string" || payload.seo_title.trim().length > 60) errors.push("seo_title трябва да е до 60 знака");
  if (typeof payload.seo_description !== "string" || payload.seo_description.trim().length > 200) errors.push("seo_description трябва да е до 200 знака");
  if (typeof payload.keywords !== "string" || payload.keywords.trim().length > 255) errors.push("keywords трябва да е до 255 знака");
  if (!Array.isArray(payload.features)) errors.push("features трябва да е масив от низове; празен масив е допустим");
  if (typeof payload.confidence !== "string" || !["висока", "ниска"].includes(payload.confidence.trim().toLowerCase())) errors.push('confidence трябва да е „висока“ или „ниска“');
  if (payload.source_urls !== undefined && !Array.isArray(payload.source_urls)) errors.push("source_urls трябва да е масив");
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

export async function generateAdminAiContent(productId: number) {
  const db = await database();
  const [product] = await db.select({ id: catalogueProducts.id, name: catalogueProducts.name, brand: catalogueProducts.brand, sku: catalogueProducts.sku }).from(catalogueProducts).where(eq(catalogueProducts.id, productId)).limit(1);
  if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Продуктът не е намерен." });
  const [settings] = await db.select().from(aiContentSettings).where(eq(aiContentSettings.id, 1)).limit(1);
  if (!settings) throw new TRPCError({ code: "NOT_FOUND", message: "AI системният prompt не е настроен." });

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

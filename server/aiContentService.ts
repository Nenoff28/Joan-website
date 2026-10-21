import { and, asc, count, eq, like, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { catalogueProductAiContent, catalogueCategories, catalogueProducts } from "../drizzle/schema";
import { getDb } from "./db";

export type AiContentStatus = "pending" | "generated" | "reviewed" | "published" | "error";
export type AiContentConfidence = "high" | "low";

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

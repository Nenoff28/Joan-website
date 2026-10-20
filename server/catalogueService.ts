import { and, asc, count, countDistinct, desc, eq, gt, gte, inArray, isNotNull, isNull, like, lte, ne, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";
import { categories as seedCategories, products as seedProducts } from "../client/src/lib/storeData";
import { adminActivities, catalogueBrochures, catalogueCategories, catalogueCategoryEnglish, catalogueManufacturers, catalogueProductCategoryLinks, catalogueProductEnglish, catalogueProducts, contactEnquiries, contactEnquiryHistory, legacyCustomerOrderLines, orderRequestItems, orderRequests, orderStatusHistory, promotionCampaignProducts, promotionCampaigns, users } from "../drizzle/schema";
import { getDb } from "./db";
import { storagePut } from "./storage";
import { notifyOwner } from "./_core/notification";
import { alignInternalCodeFeatures, alignInternalCodeTechnicalSpecs, splitProductDescription } from "./technicalSpecifications";
import { buildProductCategoryOptions, canonicalSelectedSubcategoryPath, categoryPathNodes, legacyCategoryRootsByPublicSlug as categoryRootsByPublicSlug, validateSelectedSubcategoryPath, type ProductCategoryTreeRow } from "./productCategoryAssignments";
import type { CategoryPayload as SharedCategoryPayload } from "../shared/categoryValidation";

export type ProductAvailability = "in_stock" | "on_request" | "out_of_stock";
export type OrderRequestStatus = "new" | "contacted" | "confirmed" | "closed" | "cancelled";
export type ContactEnquiryStatus = "new" | "contacted" | "closed";
export type CatalogueLanguage = "bg" | "en";
export type CategoryNode = { label: string; children?: CategoryNode[] };
type ReportingOrder = Pick<typeof orderRequests.$inferSelect, "createdAt" | "status" | "totalEur">;

export type ProductPayload = {
  categoryId: number;
  subcategoryIds?: number[];
  slug: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string | null;
  seoRobots?: "index,follow" | "noindex,follow";
  sku?: string | null;
  brand?: string | null;
  name: string;
  description: string;
  imageUrl: string;
  gallery: string[];
  imageAlt: string;
  priceEur?: number | null;
  oldPriceEur?: number | null;
  discountLabel?: string | null;
  colorName?: string | null;
  colorRgb?: string | null;
  availability: ProductAvailability;
  stockQuantity: number;
  features: string[];
  isActive: boolean;
};

export type CategoryPayload = SharedCategoryPayload;

const availabilityLabels: Record<ProductAvailability, string> = {
  in_stock: "На склад",
  on_request: "По запитване",
  out_of_stock: "Изчерпан",
};

export type BrochureUploadPayload = {
  title: string;
  sourcePdf?: { dataUrl: string; fileName: string };
  pages: Array<{ dataUrl: string; fileName: string }>;
};

export type BrochureReplacementPayload = { title: string; pageUrls: string[] };

const fallbackBrochurePages = [
  "/manus-storage/page-1_7884f6f6.jpg", "/manus-storage/page-2_9b25fc80.jpg", "/manus-storage/page-3_6c0ba892.jpg", "/manus-storage/page-4_b096aaa9.jpg",
  "/manus-storage/page-5_a794f27b.jpg", "/manus-storage/page-6_be1779c9.jpg", "/manus-storage/page-7_4cdd94c0.jpg", "/manus-storage/page-8_d10987e1.jpg",
];

function parseJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function publicProductFeatures(value: string) {
  return parseJsonArray(value).filter((feature) => !/^(?:radio|select|checkbox|text|textarea|date|time|datetime):/i.test(feature.trim()));
}

function normalizeCategoryNodes(value: unknown, depth = 0): CategoryNode[] {
  if (!Array.isArray(value) || depth > 2) return [];
  return value.flatMap((entry) => {
    if (typeof entry === "string" && entry.trim()) return [{ label: entry.trim() }];
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as { label?: unknown; children?: unknown };
    if (typeof candidate.label !== "string" || !candidate.label.trim()) return [];
    const children = normalizeCategoryNodes(candidate.children, depth + 1);
    return [{ label: candidate.label.trim(), ...(children.length ? { children } : {}) }];
  });
}

function parseCategoryTree(value: string): CategoryNode[] {
  try {
    return normalizeCategoryNodes(JSON.parse(value));
  } catch {
    return [];
  }
}

function formatPrice(value: string | null) {
  return value === null ? undefined : `${Number(value).toFixed(2)}€`;
}

function asDecimal(value?: number | null) {
  return value === undefined || value === null ? null : value.toFixed(2);
}

function parsePrice(value?: string) {
  return value ? Number(value.replace("€", "")) : null;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database connection is unavailable");
  return db;
}

let seeded: Promise<void> | null = null;
let brochureSeeded: Promise<void> | null = null;

const publicReadCache = new Map<string, { expiresAt: number; value: Promise<unknown> }>();

function cachedPublicRead<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const cached = publicReadCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value as Promise<T>;
  const value = load().catch((error) => {
    publicReadCache.delete(key);
    throw error;
  });
  publicReadCache.set(key, { expiresAt: now + ttlMs, value });
  return value;
}

/** Imports the existing public catalogue once, keeping current routes stable while admin management takes over. */
export function ensureCatalogueSeeded() {
  if (!seeded) seeded = seedCatalogue();
  return seeded;
}

function ensureBrochureSeeded() {
  if (!brochureSeeded) brochureSeeded = seedBrochure();
  return brochureSeeded;
}

async function seedCatalogue() {
  const db = await requireDb();
  const [existing] = await db.select({ total: count() }).from(catalogueCategories);
  if ((existing?.total ?? 0) > 0) {
    const currentCategories = await db.select().from(catalogueCategories);
    for (const category of seedCategories) {
      const current = currentCategories.find((item) => item.slug === category.slug);
      if (!current || parseCategoryTree(current.subcategoriesJson).length > 0) continue;
      await db.update(catalogueCategories).set({ subcategoriesJson: JSON.stringify(category.subcategories) }).where(eq(catalogueCategories.id, current.id));
    }
    return;
  }

  const categoryIdBySlug = new Map<string, number>();
  for (let index = 0; index < seedCategories.length; index += 1) {
    const category = seedCategories[index];
    const result = await db.insert(catalogueCategories).values({
      slug: category.slug,
      name: category.label,
      description: category.description,
      imageUrl: category.image,
      icon: category.icon,
      subcategoriesJson: JSON.stringify(category.subcategories),
      sortOrder: index,
      isActive: true,
    });
    categoryIdBySlug.set(category.slug, Number(result[0].insertId));
  }

  for (const product of seedProducts) {
    const categoryId = categoryIdBySlug.get(product.category);
    if (!categoryId) continue;
    const priceEur = parsePrice(product.price);
    const oldPriceEur = parsePrice(product.oldPrice);
    await db.insert(catalogueProducts).values({
      categoryId,
      slug: product.slug,
      sku: null,
      brand: product.brand ?? null,
      name: product.name,
      description: product.description,
      imageUrl: product.image,
      galleryJson: JSON.stringify(product.gallery),
      imageAlt: product.imageAlt,
      priceEur: asDecimal(priceEur),
      oldPriceEur: asDecimal(oldPriceEur),
      discountLabel: product.discount ?? null,
      availability: product.availability === "На склад" ? "in_stock" : "on_request",
      stockQuantity: product.availability === "На склад" ? 1 : 0,
      featuresJson: JSON.stringify(product.features),
      isActive: true,
    });
  }
}

async function seedBrochure() {
  const db = await requireDb();
  const [existing] = await db.select({ total: count() }).from(catalogueBrochures);
  if ((existing?.total ?? 0) > 0) return;
  await db.insert(catalogueBrochures).values({ title: "Промо брошура · август 2026", sourcePdfKey: null, sourcePdfUrl: null, pageUrlsJson: JSON.stringify(fallbackBrochurePages), pageCount: fallbackBrochurePages.length, isActive: true, isArchived: false });
}

type PublicCategoryTranslation = typeof catalogueCategoryEnglish.$inferSelect | null | undefined;
type PublicProductTranslation = typeof catalogueProductEnglish.$inferSelect | null | undefined;

function publicCategory(category: typeof catalogueCategories.$inferSelect, english?: PublicCategoryTranslation, language: CatalogueLanguage = "bg", nestedSubcategories?: CategoryNode[]) {
  const translated = language === "en" ? english : undefined;
  return {
    id: category.id,
    slug: category.slug,
    label: translated?.name ?? category.name,
    description: translated?.description ?? category.description,
    image: category.imageUrl,
    icon: category.icon,
    subcategories: nestedSubcategories ?? parseCategoryTree(translated?.subcategoriesJson ?? category.subcategoriesJson),
    metaTitle: translated?.seoTitle ?? (language === "en" ? category.legacyMetaTitleEn : category.legacyMetaTitleBg) ?? undefined,
    metaDescription: translated?.seoDescription ?? (language === "en" ? category.legacyMetaDescriptionEn : category.legacyMetaDescriptionBg) ?? undefined,
    canonicalUrl: category.legacyCanonicalUrl ?? undefined,
    metaRobots: category.legacyMetaRobots ?? undefined,
  };
}


type CategoryRow = typeof catalogueCategories.$inferSelect;
type CategoryEnglishMap = Map<number, NonNullable<PublicCategoryTranslation>>;

function categoryRowsSorted(rows: CategoryRow[]) {
  return rows.slice().sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "bg") || left.id - right.id);
}

function isNativeChild(row: CategoryRow) {
  return row.legacyCategoryId == null && row.parentId != null;
}

function effectiveParentId(row: CategoryRow, rows: CategoryRow[]) {
  if (isNativeChild(row)) return row.parentId!;
  if (row.legacyCategoryId == null) return null;
  // Imported source roots are collapsed into public roots. Resolve that mapping
  // before the source parent, otherwise existing children become orphaned in
  // the admin tree even though the storefront correctly displays them.
  for (const [slug, roots] of Object.entries(categoryRootsByPublicSlug)) {
    if (roots.includes(row.legacyParentCategoryId ?? -1)) return rows.find((candidate) => candidate.slug === slug && candidate.legacyCategoryId == null && candidate.parentId == null)?.id ?? null;
  }
  return row.legacyParentCategoryId == null ? null : rows.find((candidate) => candidate.legacyCategoryId === row.legacyParentCategoryId)?.id ?? null;
}

function categoryChildren(rows: CategoryRow[], parent: CategoryRow, publicOnly = true) {
  const roots = categoryRootsByPublicSlug[parent.slug] ?? [];
  return categoryRowsSorted(rows.filter((row) => {
    if (isNativeChild(row)) return row.parentId === parent.id;
    if (row.legacyCategoryId == null) return false;
    if (parent.legacyCategoryId != null) return row.legacyParentCategoryId === parent.legacyCategoryId;
    return row.legacyParentCategoryId != null && roots.includes(row.legacyParentCategoryId);
  }).filter((row) => (!publicOnly || row.isArchived !== true) && (!publicOnly || row.legacyCategoryId != null || row.isActive)));
}

function categoryTreeForRows(rows: CategoryRow[], parent: CategoryRow, publicOnly: boolean, language: CatalogueLanguage = "bg", englishById: CategoryEnglishMap = new Map(), depth = 0): CategoryNode[] {
  if (depth >= 4) return [];
  return categoryChildren(rows, parent, publicOnly).map((child) => {
    const translated = language === "en" ? englishById.get(child.id)?.name : undefined;
    const nested = categoryTreeForRows(rows, child, publicOnly, language, englishById, depth + 1);
    const label = translated ?? child.name;
    return nested.length ? { label, children: nested } : { label };
  });
}

function rootCategories(rows: CategoryRow[], activeOnly = false) {
  return categoryRowsSorted(rows.filter((row) => row.isArchived !== true && row.legacyCategoryId == null && row.parentId == null && (!activeOnly || row.isActive)));
}

function categoryMeta(rows: CategoryRow[]) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const meta = new Map<number, { parentId: number | null; rootId: number | null; depth: number; isMain: boolean; path: CategoryRow[] }>();
  const resolve = (row: CategoryRow, seen = new Set<number>()): { parentId: number | null; rootId: number | null; depth: number; isMain: boolean; path: CategoryRow[] } => {
    const cached = meta.get(row.id);
    if (cached) return cached;
    if (seen.has(row.id)) return { parentId: null, rootId: null, depth: 0, isMain: false, path: [] };
    seen.add(row.id);
    const parentId = effectiveParentId(row, rows);
    if (parentId == null) {
      const value = { parentId: null, rootId: row.legacyCategoryId == null ? row.id : null, depth: 0, isMain: row.legacyCategoryId == null, path: [row] };
      meta.set(row.id, value);
      return value;
    }
    const parent = byId.get(parentId);
    if (!parent) {
      const value = { parentId, rootId: null, depth: 0, isMain: false, path: [row] };
      meta.set(row.id, value);
      return value;
    }
    const parentMeta = resolve(parent, seen);
    const value = { parentId, rootId: parentMeta.rootId, depth: parentMeta.depth + 1, isMain: false, path: [...parentMeta.path, row] };
    meta.set(row.id, value);
    return value;
  };
  rows.forEach((row) => resolve(row));
  return meta;
}

function hasPublicCategoryBranch(row: CategoryRow, rows: CategoryRow[], meta: ReturnType<typeof categoryMeta>) {
  const info = meta.get(row.id);
  if (!info?.rootId) return false;
  const root = rows.find((candidate) => candidate.id === info.rootId);
  if (!root?.isActive || root.isArchived) return false;
  return info.path.every((candidate) => candidate.isArchived !== true && (candidate.legacyCategoryId != null || candidate.isActive));
}

function publicUrlForCategory(row: CategoryRow, rows: CategoryRow[], meta: ReturnType<typeof categoryMeta>) {
  const info = meta.get(row.id);
  if (!info?.rootId || !hasPublicCategoryBranch(row, rows, meta)) return null;
  const root = rows.find((candidate) => candidate.id === info.rootId);
  if (!root) return null;
  const labels = info.path.slice(1).map((candidate) => latinPathToken(candidate.name));
  return `/category/${root.slug}${labels.length ? `?path=${labels.join("~")}` : ""}`;
}

type ActivePromotion = { id: number; name: string; discountPercent: number | null; fixedPriceEur: number | null };

export type PaintColorVariant = { slug: string; label: string; sizeLabel: string | null; colorRgb: string | null; image: string; isCurrent: boolean; isOutOfStock: boolean };

const paintColourWords = new Set([
  "бяла", "бяло", "бял", "черна", "черно", "черен", "червена", "червено", "червен", "синя", "синьо", "син",
  "зелена", "зелено", "зелен", "жълта", "жълто", "жълт", "оранжева", "оранжево", "оранжев", "лилава", "лилаво", "лилав",
  "розова", "розово", "розов", "кафява", "кафяво", "кафяв", "сива", "сиво", "сив", "светлосива", "светлосив", "тъмносива", "тъмносив",
  "светлозелена", "светлозелено", "светлозелен", "тъмнозелена", "тъмнозелено", "тъмнозелен", "светложълта", "светложълто", "светложълт",
  "тъмножълта", "тъмножълто", "тъмножълт", "светлокафява", "светлокафяво", "светлокафяв", "тъмнокафява", "тъмнокафяво", "тъмнокафяв",
  "вишнева", "вишнево", "вишнев", "резеда", "кафе", "млечнокакаов", "млечнокакаова", "млечнокафява", "млечнокафяво", "млечнокафяв",
  "бежова", "бежово", "бежов", "кремава", "кремаво", "кремав", "бордо", "мента", "маслинена", "маслинено", "маслинен", "антрацит",
  "лазурен", "лазурна", "лазурно", "махагон", "мед", "палисандър", "орех", "капучино", "теракота", "портокал", "венге", "череша", "дъб", "ленен", "ленена", "графит", "металик", "пясъчен", "пясъчна", "шоколад", "кестен", "кестенов", "охра", "титан", "алуминий",
  "сребърен", "сребърна", "сребърно", "сребрист", "сребриста", "сребристо", "silver", "злато", "златен", "златна", "златно", "златист", "златиста", "златисто", "gold", "безцветен", "безцветна", "безцветно", "прозрачен", "прозрачна", "прозрачно",
  "крем", "кремена", "ванилия", "кайсия", "мандарина", "лавандула", "нуга", "сьомга", "личи", "слънчоглед", "алое", "фъстък", "марсала", "корал", "цикламен", "цикламена", "виолетов", "виолетова", "тюркоаз", "тюркоазен", "планливада", "керемиденочервен", "керемиденочервена", "керемиденочервено",
  "white", "black", "red", "blue", "green", "yellow", "orange", "purple", "pink", "brown", "grey", "gray", "clear", "transparent", "bronze", "copper", "ivory", "beige",
]);

const paintColourPhrases = [
  "старо злато", "алое вера", "шам фъстък", "план ливада", "слонова кост",
  "светло сив", "тъмно сив", "светло син", "тъмно син", "светло зелен", "тъмно зелен", "светло жълт", "тъмно жълт", "светло кафяв", "тъмно кафяв",
  "сребристо сиво", "сигнално бял", "сигнално син", "наситено син", "наситено жълт", "морско син", "трафик червено", "трафик сиво", "жълто зелен", "медено кафяво", "еврика виолетов", "керемидено червено", "шоколадово кафяво", "бял шоколад", "кафе лате", "златен пясък", "графитено сиво", "карибско син", "коралово червен", "винено червен", "вишнево червен", "вишнево червена", "вишнево червено", "злато металик", "зелен металик", "сив металик", "сл.кост",
  "киви", "канела", "череша", "бадем", "капучино", "теракота",
];

const nonPaintColourProductTokens = /(?:^|\s)(?:четк|валяк|шпатула|пистолет|шкур|лента|лепил|силикон|разредител|разтворител|диск|фрез|бормаш|ръкавиц|крепеж|маркер)(?=\s|$)/i;
const paintProductTokens = /(?:^|\s)(?:боя|бои|лак|лаков|латекс|мазил|фасаген|грунд|емайллак|спрей|байц|покритие|лазур|база)(?=\s|$)/i;

function normalizedPaintText(value: string) {
  return value.toLocaleLowerCase("bg-BG").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
}

function paintQuantityToken(name: string) {
  return name.match(/\b\d+(?:[.,]\d+)?\s*(?:мл|ml|л|l|кг|kg|гр|g)\.?/i)?.[0]?.replace(/\s+/g, "").replace(",", ".").replace(/\.$/, "").toLocaleLowerCase("bg-BG") ?? "";
}

function paintQuantityLabel(name: string) {
  return name.match(/\b\d+(?:[.,]\d+)?\s*(?:мл|ml|л|l|кг|kg|гр|g)\.?/i)?.[0]?.replace(/\.$/, "").trim() ?? null;
}

function paintColourLabel(name: string) {
  const normalized = normalizedPaintText(name).replace(/\b\d+(?:[.,]\d+)?\s*(?:мл|ml|л|l|кг|kg|гр|g)\.?/i, "").trim();
  const ral = normalized.match(/\bral\s*\d{3,4}\b/i)?.[0];
  const phrase = [...paintColourPhrases].sort((left, right) => right.length - left.length).find((candidate) => new RegExp(`(?:^|\\s)${candidate.split(" ").join("\\s+")}(?=\\s|$)`, "i").test(normalized));
  if (phrase) return phrase;
  const words = normalized.split(/\s+/).filter(Boolean);
  const candidateIndex = words.reduce((lastIndex, word, index) => paintColourWords.has(word.replace(/[.,]/g, "")) ? index : lastIndex, -1);
  if (candidateIndex >= 0) {
    const prefix = words[candidateIndex - 1] === "тъмно" || words[candidateIndex - 1] === "светло" ? words[candidateIndex - 1] : null;
    return prefix ? `${prefix} ${words[candidateIndex]}` : words[candidateIndex];
  }
  return ral ? ral.replace(/\s+/g, " ") : null;
}

function stripPaintColourTokens(value: string) {
  let stripped = value.replace(/\bral\s*\d{3,4}\b/gi, " ").replace(/\b\d+\s+в\s+\d+\b/gi, " ").replace(/\b\d{1,4}\b/g, " ");
  for (const phrase of [...paintColourPhrases].sort((left, right) => right.length - left.length)) {
    stripped = stripped.replace(new RegExp(`(?:^|\\s)${phrase.split(" ").join("\\s+")}(?=\\s|$)`, "gi"), " ");
  }
  for (const word of Array.from(paintColourWords).sort((left, right) => right.length - left.length)) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    stripped = stripped.replace(new RegExp(`(?:^|\\s)${escaped}(?=\\s|$)`, "gi"), " ");
  }
  return stripped.replace(/\s+/g, " ").trim();
}

export function derivePaintVariantGroup(product: { name: string; brand?: string | null; categoryName?: string | null; colorName?: string | null }) {
  const categoryName = normalizedPaintText(product.categoryName ?? "");
  if (!categoryName.includes("бои") && !categoryName.includes("лак") && !categoryName.includes("мазил")) return null;
  // The public root contains paint accessories as well. Do not turn a coloured
  // brush handle, tape or tool into a paint colour picker unless an admin has
  // explicitly assigned a manual colour.
  if (!product.colorName?.trim() && (!paintProductTokens.test(product.name) || nonPaintColourProductTokens.test(product.name))) return null;
  const colorLabel = product.colorName?.trim() || paintColourLabel(product.name);
  if (!colorLabel) return null;
  let normalizedName = stripPaintColourTokens(normalizedPaintText(product.name).replace(/\b\d+(?:[.,]\d+)?\s*(?:мл|ml|л|l|кг|kg|гр|g)\.?/i, ""));
  if (product.colorName?.trim()) {
    const manualColor = normalizedPaintText(product.colorName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    normalizedName = normalizedName.replace(new RegExp(`(?:^|\\s)${manualColor}(?=\\s|$)`, "i"), " ").replace(/\s+/g, " ").trim();
  }
  if (!normalizedName) return null;
  // Some spray/paint catalogues omit the pack size from the title. Keep those
  // products groupable while still separating explicitly different sizes.
  // Различните разфасовки на един и същ модел трябва да споделят една цветова група.
  return `${normalizedPaintText(product.brand ?? "")}|${normalizedName}`;
}

export function paintVariantLabel(name: string) {
  return paintColourLabel(name) ?? name;
}

function paintVariantQualifier(name: string) {
  const withoutSize = name.replace(/\b\d+(?:[.,]\d+)?\s*(?:мл|ml|л|l|кг|kg|гр|g)\.?/gi, " ");
  const ral = withoutSize.match(/\bral\s*\d{3,4}\b/i)?.[0]?.replace(/\s+/g, " ");
  if (ral) return ral.toUpperCase();
  const numericCode = withoutSize.match(/\b\d+(?:[.,]\d+)?\b/)?.[0];
  return numericCode ?? null;
}

async function activePromotionsByProductIds(db: Awaited<ReturnType<typeof requireDb>>, productIds: number[]) {
  const result = new Map<number, ActivePromotion>();
  if (!productIds.length) return result;
  const now = new Date();
  const rows = await db.select({ productId: promotionCampaignProducts.productId, campaignId: promotionCampaigns.id, name: promotionCampaigns.name, campaignDiscountPercent: promotionCampaigns.discountPercent, campaignFixedPriceEur: promotionCampaigns.fixedPriceEur, campaignStartsAt: promotionCampaigns.startsAt, campaignEndsAt: promotionCampaigns.endsAt, linkDiscountPercent: promotionCampaignProducts.discountPercent, fixedPriceEur: promotionCampaignProducts.fixedPriceEur, linkStartsAt: promotionCampaignProducts.startsAt, linkEndsAt: promotionCampaignProducts.endsAt })
    .from(promotionCampaignProducts)
    .innerJoin(promotionCampaigns, eq(promotionCampaignProducts.campaignId, promotionCampaigns.id))
    .where(and(inArray(promotionCampaignProducts.productId, productIds), eq(promotionCampaigns.isActive, true)));
  for (const row of rows) {
    const startsAt = row.linkStartsAt ?? row.campaignStartsAt;
    const endsAt = row.linkEndsAt ?? row.campaignEndsAt;
    if (startsAt > now || (endsAt && endsAt <= now)) continue;
    const discountPercent = row.linkDiscountPercent === null ? (row.campaignDiscountPercent === null ? null : Number(row.campaignDiscountPercent)) : Number(row.linkDiscountPercent);
    const fixedPriceEur = row.fixedPriceEur === null ? (row.campaignFixedPriceEur === null ? null : Number(row.campaignFixedPriceEur)) : Number(row.fixedPriceEur);
    if (!result.has(row.productId)) result.set(row.productId, { id: row.campaignId, name: row.name, discountPercent: fixedPriceEur === null ? discountPercent : null, fixedPriceEur });
  }
  return result;
}

function publicProduct(product: typeof catalogueProducts.$inferSelect, category: typeof catalogueCategories.$inferSelect, english?: PublicProductTranslation, language: CatalogueLanguage = "bg", brandLogo?: string | null, activePromotion?: ActivePromotion, colorVariants: PaintColorVariant[] = []) {
  const translated = language === "en" ? english : undefined;
  const sourceDescription = translated?.description ?? product.description;
  const features = alignInternalCodeFeatures(publicProductFeatures(translated?.featuresJson ?? product.featuresJson), product.sku, language);
  const presentation = splitProductDescription(sourceDescription, features);
  const technicalSpecs = alignInternalCodeTechnicalSpecs(presentation.technicalSpecs, product.sku, language);
  const basePrice = product.priceEur === null ? null : Number(product.priceEur);
  const promotionPrice = activePromotion && basePrice !== null
    ? activePromotion.fixedPriceEur !== null ? activePromotion.fixedPriceEur : Math.max(0, Math.round(basePrice * (1 - (activePromotion.discountPercent ?? 0) / 100) * 100) / 100)
    : null;
  return {
    id: product.id,
    slug: product.slug,
    legacyPublicSlug: product.legacyPublicSlug ?? undefined,
    sku: product.sku ?? undefined,
    brand: translated?.brand ?? product.brand ?? undefined,
    brandLogo: brandLogo ?? undefined,
    name: translated?.name ?? product.name,
    image: product.imageUrl,
    gallery: parseJsonArray(product.galleryJson),
    imageAlt: translated?.imageAlt ?? product.imageAlt,
    price: formatPrice(promotionPrice === null ? product.priceEur : promotionPrice.toFixed(2)),
    oldPrice: formatPrice(promotionPrice === null ? product.oldPriceEur : product.priceEur),
    discount: activePromotion ? activePromotion.discountPercent === null ? "Промо" : `-${activePromotion.discountPercent}%` : product.discountLabel ?? undefined,
    category: category.slug,
    availability: availabilityLabels[product.availability],
    availabilityCode: product.availability,
    stockQuantity: product.stockQuantity,
    colorName: product.colorName ?? undefined,
    colorRgb: product.colorRgb ?? undefined,
    features,
    description: presentation.description,
    technicalSpecs,
    isActive: product.isActive,
    metaTitle: translated?.seoTitle ?? (language === "en" ? product.legacyMetaTitleEn : product.legacyMetaTitleBg) ?? undefined,
    metaDescription: translated?.seoDescription ?? (language === "en" ? product.legacyMetaDescriptionEn : product.legacyMetaDescriptionBg) ?? undefined,
    canonicalUrl: product.legacyCanonicalUrl ?? undefined,
    metaRobots: product.legacyMetaRobots ?? undefined,
    colorVariants,
  };
}

function publicBrochure(brochure: typeof catalogueBrochures.$inferSelect) {
  const pageUrls = parseJsonArray(brochure.pageUrlsJson);
  return { id: brochure.id, title: brochure.title, pageUrls, pageCount: brochure.pageCount, sourcePdfUrl: brochure.sourcePdfUrl, isActive: brochure.isActive, isArchived: brochure.isArchived, createdAt: brochure.createdAt, updatedAt: brochure.updatedAt, isManaged: true };
}

async function getPublicBrochureUncached() {
  await ensureBrochureSeeded();
  const db = await requireDb();
  const [brochure] = await db.select().from(catalogueBrochures).where(and(eq(catalogueBrochures.isActive, true), eq(catalogueBrochures.isArchived, false))).orderBy(desc(catalogueBrochures.updatedAt)).limit(1);
  return brochure ? publicBrochure(brochure) : { id: 0, title: "Промо брошура", pageUrls: fallbackBrochurePages, pageCount: fallbackBrochurePages.length, sourcePdfUrl: null, isActive: true, isArchived: false, createdAt: null, updatedAt: null, isManaged: false };
}

export function getPublicBrochure() {
  return cachedPublicRead("brochure", 30_000, getPublicBrochureUncached);
}

export async function getPublicCatalogue(language: CatalogueLanguage = "bg") {
  await ensureCatalogueSeeded();
  const db = await requireDb();
  const [categoryRows, productRows] = await Promise.all([
    db.select({ category: catalogueCategories, english: catalogueCategoryEnglish }).from(catalogueCategories).leftJoin(catalogueCategoryEnglish, eq(catalogueCategoryEnglish.categoryId, catalogueCategories.id)).where(eq(catalogueCategories.isArchived, false)).orderBy(asc(catalogueCategories.sortOrder)),
    db.select({ product: catalogueProducts, category: catalogueCategories, english: catalogueProductEnglish, manufacturer: catalogueManufacturers }).from(catalogueProducts).innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id)).leftJoin(catalogueProductEnglish, eq(catalogueProductEnglish.productId, catalogueProducts.id)).leftJoin(catalogueManufacturers, eq(catalogueProducts.brand, catalogueManufacturers.name)).where(and(eq(catalogueProducts.isActive, true), eq(catalogueCategories.isActive, true), eq(catalogueCategories.isArchived, false), isNull(catalogueCategories.legacyCategoryId), isNull(catalogueCategories.parentId))).orderBy(desc(catalogueProducts.updatedAt)),
  ]);
  const rows = categoryRows.map((row) => row.category);
  const englishById: CategoryEnglishMap = new Map(categoryRows.flatMap((row) => row.english ? [[row.category.id, row.english] as const] : []));
  const roots = rootCategories(rows, true);
  const activePromotions = await activePromotionsByProductIds(db, productRows.map((row) => row.product.id));
  return { categories: roots.map((root) => publicCategory(root, englishById.get(root.id), language, categoryTreeForRows(rows, root, true, language, englishById))), products: productRows.map((row) => publicProduct(row.product, row.category, row.english, language, row.manufacturer?.officialLogoUrl, activePromotions.get(row.product.id))) };
}

export type PublicCataloguePageInput = {
  language?: CatalogueLanguage;
  promotion?: boolean;
  page: number;
  pageSize: number;
  categorySlug?: string;
  path?: string[];
  query?: string;
  brand?: string;
  brands?: string[];
  availability?: Array<ProductAvailability>;
  minPrice?: number;
  maxPrice?: number;
  sort?: "relevance" | "price-asc" | "price-desc" | "name-asc" | "name-desc";
};

const cyrillicToLatin: Record<string, string> = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya" };
const latinPathToken = (value: string) => Array.from(value.toLocaleLowerCase("bg-BG").normalize("NFD")).map((character) => cyrillicToLatin[character] ?? character).join("").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "category";

type LegacyCategoryTreeRow = Pick<typeof catalogueCategories.$inferSelect, "legacyCategoryId" | "legacyParentCategoryId" | "name" | "sortOrder">;
type LegacyCategoryBranchRow = Pick<typeof catalogueCategories.$inferSelect, "id" | "legacyCategoryId" | "legacyParentCategoryId">;

function legacyTreeForPublicCategory(rows: LegacyCategoryTreeRow[], roots: number[], depth = 3): CategoryNode[] {
  if (!roots.length) return [];
  const childrenOf = (parents: number[]) => rows.filter((row) => row.legacyParentCategoryId != null && parents.includes(row.legacyParentCategoryId)).sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "bg"));
  const build = (parents: number[], remainingDepth: number): CategoryNode[] => childrenOf(parents).map((row) => {
    const children = remainingDepth > 0 && row.legacyCategoryId != null ? build([row.legacyCategoryId], remainingDepth - 1) : [];
    return children.length ? { label: row.name, children } : { label: row.name };
  });
  return build(roots, depth);
}

export type CategoryBranchRow = Pick<CategoryRow, "id" | "legacyCategoryId" | "legacyParentCategoryId" | "parentId">;

export function descendantCategoryIds(rows: CategoryBranchRow[], selectedInternalIds: number[]) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const selected = new Set(selectedInternalIds);
  const pending = [...selectedInternalIds];
  while (pending.length) {
    const parentId = pending.shift()!;
    const parent = byId.get(parentId);
    for (const child of rows) {
      const nativeChild = child.parentId != null && child.parentId === parentId;
      const legacyChild = parent?.legacyCategoryId != null && child.legacyParentCategoryId === parent.legacyCategoryId;
      if (!nativeChild && !legacyChild || selected.has(child.id)) continue;
      selected.add(child.id);
      pending.push(child.id);
    }
  }
  return Array.from(selected);
}

async function resolvePublicPathCategoryIds(category: CategoryRow, path: string[], language: CatalogueLanguage) {
  if (!path.length) return [];
  const db = await requireDb();
  const rowsWithEnglish = await db.select({ category: catalogueCategories, english: catalogueCategoryEnglish }).from(catalogueCategories).leftJoin(catalogueCategoryEnglish, eq(catalogueCategoryEnglish.categoryId, catalogueCategories.id)).where(eq(catalogueCategories.isArchived, false));
  const rows = rowsWithEnglish.map((row) => row.category);
  const englishById: CategoryEnglishMap = new Map(rowsWithEnglish.flatMap((row) => row.english ? [[row.category.id, row.english] as const] : []));
  let candidates: CategoryRow[] = [category];
  for (const token of path) {
    const normalized = token.trim();
    const next = candidates.flatMap((parent) => categoryChildren(rows, parent, true)).filter((row, index, all) => {
      if (all.findIndex((candidate) => candidate.id === row.id) !== index) return false;
      const label = language === "en" ? englishById.get(row.id)?.name ?? row.name : row.name;
      return row.slug === normalized || label === normalized || row.name === normalized || latinPathToken(label) === normalized || latinPathToken(row.name) === normalized;
    });
    if (!next.length) return [];
    candidates = next;
  }
  const branchRows = rows.map((row) => ({ id: row.id, legacyCategoryId: row.legacyCategoryId, legacyParentCategoryId: row.legacyParentCategoryId, parentId: row.parentId }));
  return descendantCategoryIds(branchRows, candidates.map((row) => row.id));
}

export function publicCataloguePromotionPredicate() {
  return or(
    and(isNotNull(catalogueProducts.oldPriceEur), isNotNull(catalogueProducts.priceEur), gt(catalogueProducts.oldPriceEur, catalogueProducts.priceEur)),
    sql`TRIM(COALESCE(${catalogueProducts.discountLabel}, '')) <> ''`,
    sql`EXISTS (SELECT 1 FROM promotion_campaign_products pcp INNER JOIN promotion_campaigns pc ON pc.id = pcp.campaignId WHERE pcp.productId = ${catalogueProducts.id} AND pc.isActive = true AND pc.startsAt <= CURRENT_TIMESTAMP() AND (pc.endsAt IS NULL OR pc.endsAt > CURRENT_TIMESTAMP()))`,
  )!;
}

export function publicCatalogueConditions(input: PublicCataloguePageInput, categoryId?: number) {
  const conditions = [eq(catalogueProducts.isActive, true), eq(catalogueCategories.isActive, true), eq(catalogueCategories.isArchived, false)];
  if (categoryId) conditions.push(eq(catalogueProducts.categoryId, categoryId));
  if (input.promotion) conditions.push(publicCataloguePromotionPredicate());
  const selectedBrands = input.brands?.length ? input.brands : input.brand ? [input.brand] : [];
  if (selectedBrands.length) {
    const brandConditions = selectedBrands.map((brand) => input.language === "en" ? sql`COALESCE(${catalogueProductEnglish.brand}, ${catalogueProducts.brand}) = ${brand}` : eq(catalogueProducts.brand, brand));
    conditions.push(or(...brandConditions)!);
  }
  if (input.availability?.length) conditions.push(inArray(catalogueProducts.availability, input.availability));
  if (input.minPrice != null) conditions.push(gte(catalogueProducts.priceEur, String(input.minPrice)));
  if (input.maxPrice != null) conditions.push(lte(catalogueProducts.priceEur, String(input.maxPrice)));
  if (input.query) {
    const needle = `%${input.query.replace(/[\\%_]/g, "\\$&")}%`;
    const name = input.language === "en" ? sql<string>`COALESCE(${catalogueProductEnglish.name}, ${catalogueProducts.name})` : catalogueProducts.name;
    const brand = input.language === "en" ? sql<string>`COALESCE(${catalogueProductEnglish.brand}, ${catalogueProducts.brand})` : catalogueProducts.brand;
    const features = input.language === "en" ? sql<string>`COALESCE(${catalogueProductEnglish.featuresJson}, ${catalogueProducts.featuresJson})` : catalogueProducts.featuresJson;
    conditions.push(or(like(name, needle), like(brand, needle), like(features, needle), like(catalogueProducts.sku, needle))!);
  }
  return conditions;
}

function publicCatalogueOrder(sort: PublicCataloguePageInput["sort"], language: CatalogueLanguage = "bg") {
  const outOfStockLast = sql`CASE WHEN ${catalogueProducts.availability} = 'out_of_stock' THEN 1 ELSE 0 END`;
  const name = language === "en" ? sql<string>`COALESCE(${catalogueProductEnglish.name}, ${catalogueProducts.name})` : catalogueProducts.name;
  if (sort === "price-asc") return [outOfStockLast, asc(catalogueProducts.priceEur), asc(name)] as const;
  if (sort === "price-desc") return [outOfStockLast, desc(catalogueProducts.priceEur), asc(name)] as const;
  if (sort === "name-asc") return [outOfStockLast, asc(name)] as const;
  if (sort === "name-desc") return [outOfStockLast, desc(name)] as const;
  return [outOfStockLast, desc(catalogueProducts.updatedAt), asc(name)] as const;
}

async function getPublicCatalogueMetadataUncached(language: CatalogueLanguage = "bg") {
  await ensureCatalogueSeeded();
  const db = await requireDb();
  const rowsWithEnglish = await db.select({ category: catalogueCategories, english: catalogueCategoryEnglish }).from(catalogueCategories).leftJoin(catalogueCategoryEnglish, eq(catalogueCategoryEnglish.categoryId, catalogueCategories.id)).orderBy(asc(catalogueCategories.sortOrder));
  const rows = rowsWithEnglish.map((row) => row.category);
  const englishById: CategoryEnglishMap = new Map(rowsWithEnglish.flatMap((row) => row.english ? [[row.category.id, row.english] as const] : []));
  return { categories: rootCategories(rows, true).map((root) => publicCategory(root, englishById.get(root.id), language, categoryTreeForRows(rows, root, true, language, englishById))) };
}

export function getPublicCatalogueMetadata(language: CatalogueLanguage = "bg") {
  return cachedPublicRead(`metadata:${language}`, 30_000, () => getPublicCatalogueMetadataUncached(language));
}

async function getPublicCataloguePageUncached(input: PublicCataloguePageInput) {
  await ensureCatalogueSeeded();
  const db = await requireDb();
  const language = input.language ?? "bg";
  const page = Math.max(1, input.page);
  const pageSize = Math.min(48, Math.max(1, input.pageSize));
  const category = input.categorySlug ? (await db.select().from(catalogueCategories).where(and(eq(catalogueCategories.slug, input.categorySlug), eq(catalogueCategories.isActive, true), eq(catalogueCategories.isArchived, false), isNull(catalogueCategories.legacyCategoryId), isNull(catalogueCategories.parentId))).limit(1))[0] : undefined;
  const pathCategoryIds = category && input.path?.length ? await resolvePublicPathCategoryIds(category, input.path, language) : [];
  if (category && input.path?.length && !pathCategoryIds.length) return { products: [], total: 0, page, pageSize, brands: [] as string[] };
  const conditions = publicCatalogueConditions(input, category && !input.path?.length ? category.id : undefined);
  const order = publicCatalogueOrder(input.sort, language);
  const withPath = pathCategoryIds.length > 0;
  const selectProducts = withPath
    ? db.selectDistinct({ product: catalogueProducts, category: catalogueCategories, english: catalogueProductEnglish, manufacturer: catalogueManufacturers }).from(catalogueProducts).innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id)).leftJoin(catalogueProductEnglish, eq(catalogueProductEnglish.productId, catalogueProducts.id)).leftJoin(catalogueManufacturers, eq(catalogueProducts.brand, catalogueManufacturers.name)).innerJoin(catalogueProductCategoryLinks, eq(catalogueProductCategoryLinks.productId, catalogueProducts.id)).where(and(...conditions, eq(catalogueProducts.categoryId, category!.id), inArray(catalogueProductCategoryLinks.categoryId, pathCategoryIds))).orderBy(...order).limit(pageSize).offset((page - 1) * pageSize)
    : db.select({ product: catalogueProducts, category: catalogueCategories, english: catalogueProductEnglish, manufacturer: catalogueManufacturers }).from(catalogueProducts).innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id)).leftJoin(catalogueProductEnglish, eq(catalogueProductEnglish.productId, catalogueProducts.id)).leftJoin(catalogueManufacturers, eq(catalogueProducts.brand, catalogueManufacturers.name)).where(and(...conditions)).orderBy(...order).limit(pageSize).offset((page - 1) * pageSize);
  const countPromise = withPath
    ? db.select({ total: countDistinct(catalogueProducts.id) }).from(catalogueProducts).innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id)).leftJoin(catalogueProductEnglish, eq(catalogueProductEnglish.productId, catalogueProducts.id)).innerJoin(catalogueProductCategoryLinks, eq(catalogueProductCategoryLinks.productId, catalogueProducts.id)).where(and(...conditions, eq(catalogueProducts.categoryId, category!.id), inArray(catalogueProductCategoryLinks.categoryId, pathCategoryIds)))
    : db.select({ total: count() }).from(catalogueProducts).innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id)).leftJoin(catalogueProductEnglish, eq(catalogueProductEnglish.productId, catalogueProducts.id)).where(and(...conditions));
  const [rows, countRows, brandRows] = await Promise.all([
    selectProducts,
    countPromise,
    db.select({ brand: language === "en" ? sql<string>`COALESCE(${catalogueProductEnglish.brand}, ${catalogueProducts.brand})` : catalogueProducts.brand }).from(catalogueProducts).innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id)).leftJoin(catalogueProductEnglish, eq(catalogueProductEnglish.productId, catalogueProducts.id)).where(and(...publicCatalogueConditions({ ...input, language, brand: undefined, brands: undefined, query: undefined, minPrice: undefined, maxPrice: undefined, availability: undefined }, category && !input.path?.length ? category.id : undefined))).groupBy(language === "en" ? sql`COALESCE(${catalogueProductEnglish.brand}, ${catalogueProducts.brand})` : catalogueProducts.brand).orderBy(asc(language === "en" ? sql<string>`COALESCE(${catalogueProductEnglish.brand}, ${catalogueProducts.brand})` : catalogueProducts.brand)),
  ]);
  const activePromotions = await activePromotionsByProductIds(db, rows.map((row) => row.product.id));
  return { products: rows.map((row) => publicProduct(row.product, row.category, row.english, language, row.manufacturer?.officialLogoUrl, activePromotions.get(row.product.id))), total: Number(countRows[0]?.total ?? 0), page, pageSize, brands: brandRows.flatMap((row) => row.brand ? [row.brand] : []) };
}

export function getPublicCataloguePage(input: PublicCataloguePageInput) {
  return cachedPublicRead(`page:${JSON.stringify(input)}`, 10_000, () => getPublicCataloguePageUncached(input));
}

/** Aggregated historical quantities are used only for transparent public popularity ordering. */
async function getPublicBestSellersUncached(limit = 8, language: CatalogueLanguage = "bg") {
  await ensureCatalogueSeeded();
  const db = await requireDb();
  const cappedLimit = Math.min(24, Math.max(1, limit));
  const quantityTotals = db
    .select({ legacyProductId: legacyCustomerOrderLines.legacyProductId, units: sql<number>`SUM(${legacyCustomerOrderLines.quantity})`.as("units") })
    .from(legacyCustomerOrderLines)
    .where(sql`${legacyCustomerOrderLines.legacyProductId} IS NOT NULL`)
    .groupBy(legacyCustomerOrderLines.legacyProductId)
    .as("historical_product_quantities");
  const rows = await db
    .select({ product: catalogueProducts, category: catalogueCategories, english: catalogueProductEnglish, manufacturer: catalogueManufacturers, units: quantityTotals.units })
    .from(quantityTotals)
    .innerJoin(catalogueProducts, eq(catalogueProducts.legacyProductId, quantityTotals.legacyProductId))
    .innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id))
    .leftJoin(catalogueProductEnglish, eq(catalogueProductEnglish.productId, catalogueProducts.id))
    .leftJoin(catalogueManufacturers, eq(catalogueProducts.brand, catalogueManufacturers.name))
    .where(and(eq(catalogueProducts.isActive, true), eq(catalogueCategories.isActive, true), eq(catalogueCategories.isArchived, false)))
    .orderBy(desc(quantityTotals.units), desc(catalogueProducts.updatedAt), asc(catalogueProducts.name))
    .limit(cappedLimit);
  const activePromotions = await activePromotionsByProductIds(db, rows.map((row) => row.product.id));
  return rows.map((row) => publicProduct(row.product, row.category, row.english, language, row.manufacturer?.officialLogoUrl, activePromotions.get(row.product.id)));
}

export function getPublicBestSellers(limit = 8, language: CatalogueLanguage = "bg") {
  return cachedPublicRead(`best-sellers:${limit}:${language}`, 30_000, () => getPublicBestSellersUncached(limit, language));
}

async function getPublicProductBySlugUncached(slug: string, language: CatalogueLanguage = "bg") {
  await ensureCatalogueSeeded();
  const db = await requireDb();
  const [row] = await db.select({ product: catalogueProducts, category: catalogueCategories, english: catalogueProductEnglish, manufacturer: catalogueManufacturers }).from(catalogueProducts).innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id)).leftJoin(catalogueProductEnglish, eq(catalogueProductEnglish.productId, catalogueProducts.id)).leftJoin(catalogueManufacturers, eq(catalogueProducts.brand, catalogueManufacturers.name)).where(and(or(eq(catalogueProducts.slug, slug), eq(catalogueProducts.legacyPublicSlug, slug))!, eq(catalogueProducts.isActive, true), eq(catalogueCategories.isActive, true), eq(catalogueCategories.isArchived, false))).limit(1);
  if (!row) return null;
  const variantGroup = derivePaintVariantGroup({ name: row.product.name, brand: row.product.brand, categoryName: row.category.name, colorName: row.product.colorName });
  const [relatedRows, variantRows] = await Promise.all([
    db.select({ product: catalogueProducts, category: catalogueCategories, english: catalogueProductEnglish, manufacturer: catalogueManufacturers }).from(catalogueProducts).innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id)).leftJoin(catalogueProductEnglish, eq(catalogueProductEnglish.productId, catalogueProducts.id)).leftJoin(catalogueManufacturers, eq(catalogueProducts.brand, catalogueManufacturers.name)).where(and(ne(catalogueProducts.id, row.product.id), eq(catalogueProducts.isActive, true), eq(catalogueCategories.isActive, true), eq(catalogueCategories.isArchived, false))).orderBy(sql`CASE WHEN ${catalogueProducts.categoryId} = ${row.product.categoryId} THEN 0 ELSE 1 END`, desc(catalogueProducts.updatedAt), asc(catalogueProducts.name)).limit(16),
    variantGroup
      ? db.select({ product: catalogueProducts }).from(catalogueProducts).where(and(eq(catalogueProducts.categoryId, row.product.categoryId), row.product.brand ? eq(catalogueProducts.brand, row.product.brand) : isNull(catalogueProducts.brand), eq(catalogueProducts.isActive, true), eq(catalogueProducts.isArchived, false))).orderBy(asc(catalogueProducts.name)).limit(200)
      : Promise.resolve([] as Array<{ product: typeof catalogueProducts.$inferSelect }>),
  ]);
  const variantCandidates = variantRows.filter((candidate) => derivePaintVariantGroup({ name: candidate.product.name, brand: candidate.product.brand, categoryName: row.category.name, colorName: candidate.product.colorName }) === variantGroup);
  const variantIds = variantCandidates.map((candidate) => candidate.product.id);
  const allPromotionIds = [row.product.id, ...relatedRows.map((candidate) => candidate.product.id), ...variantIds];
  const activePromotions = await activePromotionsByProductIds(db, Array.from(new Set(allPromotionIds)));
  const colorVariants = variantCandidates.map((candidate, index, candidates) => {
    const baseLabel = candidate.product.colorName?.trim() || paintVariantLabel(candidate.product.name);
    const sizeLabel = paintQuantityLabel(candidate.product.name);
    const duplicate = candidates.filter((other) => (other.product.colorName?.trim() || paintVariantLabel(other.product.name)).toLocaleLowerCase("bg-BG") === baseLabel.toLocaleLowerCase("bg-BG") && paintQuantityLabel(other.product.name) === sizeLabel).length > 1;
    const qualifier = duplicate ? paintVariantQualifier(candidate.product.name) : null;
    return {
    slug: candidate.product.slug,
    label: qualifier ? `${baseLabel} · ${qualifier}` : baseLabel,
    sizeLabel,
    colorRgb: candidate.product.colorRgb ?? null,
    image: candidate.product.imageUrl,
    isCurrent: candidate.product.id === row.product.id,
    isOutOfStock: candidate.product.availability === "out_of_stock" || (candidate.product.stockQuantity != null && Number(candidate.product.stockQuantity) <= 0),
    };
  });
  return { product: publicProduct(row.product, row.category, row.english, language, row.manufacturer?.officialLogoUrl, activePromotions.get(row.product.id), colorVariants), related: relatedRows.map((candidate) => publicProduct(candidate.product, candidate.category, candidate.english, language, candidate.manufacturer?.officialLogoUrl, activePromotions.get(candidate.product.id))) };
}

export function getPublicProductBySlug(slug: string, language: CatalogueLanguage = "bg") {
  return cachedPublicRead(`product:${slug}:${language}`, 10_000, () => getPublicProductBySlugUncached(slug, language));
}

async function getPublicProductsBySlugsUncached(slugs: string[], language: CatalogueLanguage = "bg") {
  if (!slugs.length) return [];
  await ensureCatalogueSeeded();
  const db = await requireDb();
  const rows = await db.select({ product: catalogueProducts, category: catalogueCategories, english: catalogueProductEnglish, manufacturer: catalogueManufacturers }).from(catalogueProducts).innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id)).leftJoin(catalogueProductEnglish, eq(catalogueProductEnglish.productId, catalogueProducts.id)).leftJoin(catalogueManufacturers, eq(catalogueProducts.brand, catalogueManufacturers.name)).where(and(or(inArray(catalogueProducts.slug, slugs), inArray(catalogueProducts.legacyPublicSlug, slugs))!, eq(catalogueProducts.isActive, true), eq(catalogueCategories.isActive, true), eq(catalogueCategories.isArchived, false)));
  const activePromotions = await activePromotionsByProductIds(db, rows.map((row) => row.product.id));
  return rows.map((row) => publicProduct(row.product, row.category, row.english, language, row.manufacturer?.officialLogoUrl, activePromotions.get(row.product.id)));
}

export function getPublicProductsBySlugs(slugs: string[], language: CatalogueLanguage = "bg") {
  return cachedPublicRead(`products:${JSON.stringify([...slugs].sort())}:${language}`, 10_000, () => getPublicProductsBySlugsUncached(slugs, language));
}

export async function getPublicSitemapEntries() {
  await ensureCatalogueSeeded();
  const db = await requireDb();
  const [categories, products] = await Promise.all([
    db.select({ slug: catalogueCategories.slug, updatedAt: catalogueCategories.updatedAt }).from(catalogueCategories).where(and(eq(catalogueCategories.isActive, true), eq(catalogueCategories.isArchived, false), isNull(catalogueCategories.legacyCategoryId), isNull(catalogueCategories.parentId))),
    db.select({ slug: catalogueProducts.slug, updatedAt: catalogueProducts.updatedAt }).from(catalogueProducts).innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id)).where(and(eq(catalogueProducts.isActive, true), eq(catalogueCategories.isActive, true), eq(catalogueCategories.isArchived, false), isNull(catalogueCategories.legacyCategoryId), isNull(catalogueCategories.parentId))),
  ]);
  return { categories, products };
}

export async function getAdminCategories(options?: { includeArchived?: boolean }) {
  await ensureCatalogueSeeded();
  const db = await requireDb();
  const categoryQuery = db.select().from(catalogueCategories);
  const filteredCategoryQuery = options?.includeArchived || typeof categoryQuery.where !== "function" ? categoryQuery : categoryQuery.where(eq(catalogueCategories.isArchived, false));
  const rows = await filteredCategoryQuery.orderBy(asc(catalogueCategories.sortOrder), asc(catalogueCategories.id));
  const meta = categoryMeta(rows);
  return rows.map((category) => {
    const info = meta.get(category.id) ?? { parentId: null, rootId: null, depth: 0, isMain: false, path: [category] };
    return {
      ...publicCategory(category, undefined, "bg", categoryTreeForRows(rows, category, false)),
      parentId: info.parentId,
      rootId: info.rootId,
      depth: info.depth,
      isMain: info.isMain,
      legacyCategoryId: category.legacyCategoryId,
      publicUrl: publicUrlForCategory(category, rows, meta),
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      isArchived: category.isArchived,
    };
  });
}

export async function getAdminProductCategories() {
  await ensureCatalogueSeeded();
  const db = await requireDb();
  const [rootRows, taxonomyRows] = await Promise.all([
    db.select({ id: catalogueCategories.id, legacyCategoryId: catalogueCategories.legacyCategoryId, legacyParentCategoryId: catalogueCategories.legacyParentCategoryId, parentId: catalogueCategories.parentId, slug: catalogueCategories.slug, name: catalogueCategories.name, sortOrder: catalogueCategories.sortOrder, isActive: catalogueCategories.isActive, isArchived: catalogueCategories.isArchived }).from(catalogueCategories).where(and(eq(catalogueCategories.isActive, true), eq(catalogueCategories.isArchived, false), isNull(catalogueCategories.legacyCategoryId), isNull(catalogueCategories.parentId))).orderBy(asc(catalogueCategories.sortOrder)),
    db.select({ id: catalogueCategories.id, legacyCategoryId: catalogueCategories.legacyCategoryId, legacyParentCategoryId: catalogueCategories.legacyParentCategoryId, parentId: catalogueCategories.parentId, slug: catalogueCategories.slug, name: catalogueCategories.name, sortOrder: catalogueCategories.sortOrder, isActive: catalogueCategories.isActive, isArchived: catalogueCategories.isArchived }).from(catalogueCategories).where(and(eq(catalogueCategories.isArchived, false), or(isNotNull(catalogueCategories.legacyCategoryId), isNotNull(catalogueCategories.parentId)))),
  ]);
  return buildProductCategoryOptions(rootRows, taxonomyRows);
}

export async function getAdminInventoryProducts(options?: { query?: string; categoryId?: number }) {
  await ensureCatalogueSeeded();
  const db = await requireDb();
  const term = options?.query?.trim();
  const filters = [eq(catalogueProducts.isArchived, false), eq(catalogueCategories.isArchived, false)];
  if (options?.categoryId) filters.push(eq(catalogueProducts.categoryId, options.categoryId));
  if (term) {
    const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(or(like(catalogueProducts.name, pattern), like(catalogueProducts.sku, pattern), like(catalogueProducts.slug, pattern))!);
  }
  const [rows, categories] = await Promise.all([
    db.select({ product: catalogueProducts, category: catalogueCategories }).from(catalogueProducts).innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id)).where(and(...filters)).orderBy(asc(catalogueProducts.name), asc(catalogueProducts.id)).limit(250),
    db.select({ id: catalogueCategories.id, label: catalogueCategories.name }).from(catalogueCategories).where(and(eq(catalogueCategories.isActive, true), eq(catalogueCategories.isArchived, false), isNull(catalogueCategories.legacyCategoryId), isNull(catalogueCategories.parentId))).orderBy(asc(catalogueCategories.sortOrder), asc(catalogueCategories.name)),
  ]);
  return {
    products: rows.map(({ product, category }) => ({ id: product.id, name: product.name, sku: product.sku, image: product.imageUrl, category: category.name, categoryId: category.id, availability: availabilityLabels[product.availability], availabilityCode: product.availability, stockQuantity: product.stockQuantity })),
    categories,
    hasMore: rows.length === 250,
  };
}

export async function getAdminBrochures() {
  await ensureBrochureSeeded();
  const db = await requireDb();
  const rows = await db.select().from(catalogueBrochures).orderBy(desc(catalogueBrochures.updatedAt));
  return rows.map(publicBrochure);
}

export async function getAdminProducts(options?: { includeArchived?: boolean }) {
  await ensureCatalogueSeeded();
  const db = await requireDb();
  const [rows, taxonomyRows] = await Promise.all([
    db.select({ product: catalogueProducts, category: catalogueCategories }).from(catalogueProducts).innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id)).where(options?.includeArchived ? undefined : and(eq(catalogueProducts.isArchived, false), eq(catalogueCategories.isArchived, false))).orderBy(desc(catalogueProducts.updatedAt)),
    db.select({ id: catalogueCategories.id, legacyCategoryId: catalogueCategories.legacyCategoryId, legacyParentCategoryId: catalogueCategories.legacyParentCategoryId, parentId: catalogueCategories.parentId, name: catalogueCategories.name, sortOrder: catalogueCategories.sortOrder, isActive: catalogueCategories.isActive, isArchived: catalogueCategories.isArchived }).from(catalogueCategories).where(and(eq(catalogueCategories.isArchived, false), or(isNotNull(catalogueCategories.legacyCategoryId), isNotNull(catalogueCategories.parentId)))),
  ]);
  const linksByProduct = new Map<number, Array<{ categoryId: number; position: number | null }>>();
  if (rows.length) {
    const links = await db.select({ productId: catalogueProductCategoryLinks.productId, categoryId: catalogueProductCategoryLinks.categoryId, position: catalogueProductCategoryLinks.position }).from(catalogueProductCategoryLinks).where(inArray(catalogueProductCategoryLinks.productId, rows.map(({ product }) => product.id)));
    for (const link of links) linksByProduct.set(link.productId, [...(linksByProduct.get(link.productId) ?? []), { categoryId: link.categoryId, position: link.position }]);
  }
  const taxonomy = taxonomyRows as ProductCategoryTreeRow[];
  return rows.map((row) => {
    const path = canonicalSelectedSubcategoryPath(taxonomy, categoryRootsByPublicSlug[row.category.slug] ?? [], linksByProduct.get(row.product.id) ?? [], row.category.id);
    return { ...publicProduct(row.product, row.category), isArchived: row.product.isArchived, seoTitle: row.product.legacyMetaTitleBg ?? "", seoDescription: row.product.legacyMetaDescriptionBg ?? "", seoKeywords: row.product.legacySeoKeywordBg ?? "", seoRobots: row.product.legacyMetaRobots === "noindex,follow" ? "noindex,follow" as const : "index,follow" as const, categoryId: row.product.categoryId, subcategoryIds: path.map((item) => item.id), subcategoryPath: categoryPathNodes(path), categoryName: row.category.name, createdAt: row.product.createdAt, updatedAt: row.product.updatedAt };
  });
}

/** Returns promotion-ready products, optionally restricted to a category branch. */
export async function getAdminPromotionProducts(categoryId?: number) {
  const products = await getAdminProducts();
  if (!categoryId) return products;
  return products.filter((product) => product.categoryId === categoryId || product.subcategoryIds.includes(categoryId));
}

export async function getAdminOrders() {
  const db = await requireDb();
  const orders = await db.select().from(orderRequests).where(eq(orderRequests.isDeleted, false)).orderBy(desc(orderRequests.createdAt));
  if (!orders.length) return orders.map((order) => ({ ...order, items: [] as Array<typeof orderRequestItems.$inferSelect> }));
  const items = await db.select().from(orderRequestItems).where(inArray(orderRequestItems.orderRequestId, orders.map((order) => order.id)));
  return orders.map((order) => ({ ...order, items: items.filter((item) => item.orderRequestId === order.id) }));
}

function orderParameters(parametersJson: string | null | undefined, fallbackFeaturesJson?: string | null) {
  const parameters = parametersJson ? parseJsonArray(parametersJson) : [];
  return parameters.length ? parameters : publicProductFeatures(fallbackFeaturesJson ?? "");
}

export async function getAdminOrderDetail(id: number) {
  if (!Number.isInteger(id) || id <= 0) throw new Error("Поръчката не е намерена.");
  const db = await requireDb();
  const [headerRow] = await db.select({ order: orderRequests, productFeaturesJson: catalogueProducts.featuresJson }).from(orderRequests).leftJoin(catalogueProducts, eq(orderRequests.productId, catalogueProducts.id)).where(eq(orderRequests.id, id)).limit(1);
  if (!headerRow) throw new Error("Поръчката не е намерена.");
  const [itemRows, history] = await Promise.all([
    db.select({ item: orderRequestItems, productFeaturesJson: catalogueProducts.featuresJson }).from(orderRequestItems).leftJoin(catalogueProducts, eq(orderRequestItems.productId, catalogueProducts.id)).where(eq(orderRequestItems.orderRequestId, id)),
    db.select({ id: orderStatusHistory.id, status: orderStatusHistory.status, comment: orderStatusHistory.comment, authorId: orderStatusHistory.authorId, authorName: orderStatusHistory.authorName, createdAt: orderStatusHistory.createdAt }).from(orderStatusHistory).where(eq(orderStatusHistory.orderRequestId, id)).orderBy(desc(orderStatusHistory.createdAt), desc(orderStatusHistory.id)),
  ]);
  const items = itemRows.length
    ? itemRows.map(({ item, productFeaturesJson }) => ({ ...item, parameters: orderParameters(item.parametersJson, productFeaturesJson) }))
    : [{ id: 0, orderRequestId: headerRow.order.id, productId: headerRow.order.productId, productName: headerRow.order.productName, productSku: headerRow.order.productSku, productImageUrl: headerRow.order.productImageUrl, parametersJson: null, quantity: headerRow.order.quantity, priceEur: headerRow.order.priceEur, totalEur: headerRow.order.totalEur, createdAt: headerRow.order.createdAt, parameters: orderParameters(null, headerRow.productFeaturesJson) }];
  return { ...headerRow.order, items, history };
}

export async function getAdminContactEnquiries() {
  const db = await requireDb();
  return db.select().from(contactEnquiries).where(eq(contactEnquiries.isDeleted, false)).orderBy(desc(contactEnquiries.createdAt));
}

export async function getAdminContactEnquiryDetail(id: number) {
  if (!Number.isInteger(id) || id <= 0) throw new Error("Запитването не е намерено.");
  const db = await requireDb();
  const [enquiries, history] = await Promise.all([
    db.select().from(contactEnquiries).where(eq(contactEnquiries.id, id)).limit(1),
    db.select({
      id: contactEnquiryHistory.id,
      status: contactEnquiryHistory.status,
      comment: contactEnquiryHistory.comment,
      authorId: contactEnquiryHistory.authorId,
      authorName: contactEnquiryHistory.authorName,
      createdAt: contactEnquiryHistory.createdAt,
    }).from(contactEnquiryHistory).where(eq(contactEnquiryHistory.contactEnquiryId, id)).orderBy(desc(contactEnquiryHistory.createdAt), desc(contactEnquiryHistory.id)),
  ]);
  const enquiry = enquiries[0];
  if (!enquiry) throw new Error("Запитването не е намерено.");
  return { ...enquiry, history };
}

export async function getAdminSummary() {
  await ensureCatalogueSeeded();
  const db = await requireDb();
  const [[productCount], [categoryCount], [newOrderCount], [lowStockCount], recentOrders] = await Promise.all([
    db.select({ total: count() }).from(catalogueProducts).where(eq(catalogueProducts.isActive, true)),
    db.select({ total: count() }).from(catalogueCategories).where(and(eq(catalogueCategories.isActive, true), eq(catalogueCategories.isArchived, false))),
    db.select({ total: count() }).from(orderRequests).where(and(eq(orderRequests.status, "new"), eq(orderRequests.isDeleted, false))),
    db.select({ total: count() }).from(catalogueProducts).where(and(eq(catalogueProducts.isActive, true), eq(catalogueProducts.availability, "in_stock"))),
    db.select().from(orderRequests).where(eq(orderRequests.isDeleted, false)).orderBy(desc(orderRequests.createdAt)).limit(5),
  ]);
  return {
    products: productCount?.total ?? 0,
    categories: categoryCount?.total ?? 0,
    newOrders: newOrderCount?.total ?? 0,
    inStockProducts: lowStockCount?.total ?? 0,
    recentOrders,
  };
}

/** Returns real operational queues derived from current catalogue, request, and audit records. */
export async function getAdminOperations(permissions?: readonly string[]) {
  const allowed = (key: string) => !permissions || permissions.includes(key);
  await ensureCatalogueSeeded();
  const db = await requireDb();
  const [products, orders, activityRows] = await Promise.all([
    allowed("dashboard.read") || allowed("products.read") || allowed("inventory.read") || allowed("promotions.read") ? getAdminProducts() : Promise.resolve([]),
    allowed("dashboard.read") || allowed("orders.read") ? getAdminOrders() : Promise.resolve([]),
    allowed("activity.read") ? db.select({ activity: adminActivities, adminName: users.name, adminEmail: users.email }).from(adminActivities).innerJoin(users, eq(adminActivities.adminUserId, users.id)).orderBy(desc(adminActivities.createdAt)).limit(24) : Promise.resolve([]),
  ]);
  const activeProducts = products.filter((product) => product.isActive);
  const promotions = activeProducts.filter((product) => Boolean(product.discount || product.oldPrice));
  const inventoryQueue = activeProducts.filter((product) => product.availabilityCode !== "out_of_stock" && (product.stockQuantity ?? 0) <= 2).slice(0, 12);
  const qualityQueue = activeProducts.map((product) => {
    const issues = [!product.sku ? "Липсва код" : null, !product.price ? "Липсва цена" : null, product.gallery.length < 2 ? "Непълна галерия" : null, product.features.length === 0 ? "Липсват характеристики" : null].filter((item): item is string => Boolean(item));
    return { ...product, issues };
  }).filter((product) => product.issues.length > 0).slice(0, 12);
  const orderCounts: Record<OrderRequestStatus, number> = { new: 0, contacted: 0, confirmed: 0, closed: 0, cancelled: 0 };
  orders.forEach((order) => { orderCounts[order.status] += 1; });
  return {
    metrics: { activeProducts: activeProducts.length, promotions: promotions.length, stockAttention: inventoryQueue.length, catalogueIssues: qualityQueue.length, openRequests: orderCounts.new + orderCounts.contacted + orderCounts.confirmed },
    promotions: allowed("promotions.read") || allowed("products.read") ? promotions.slice(0, 24) : [],
    inventoryQueue: allowed("inventory.read") || allowed("products.read") ? inventoryQueue : [],
    qualityQueue: allowed("products.read") ? qualityQueue : [],
    orderCounts,
    reporting: buildAdminReportingSnapshot(allowed("dashboard.read") ? orders : []),
    activities: activityRows.map((row) => ({ id: row.activity.id, action: row.activity.action, entityType: row.activity.entityType, entityId: row.activity.entityId, metadata: (() => { try { return JSON.parse(row.activity.metadataJson) as Record<string, unknown>; } catch { return {}; } })(), createdAt: row.activity.createdAt, adminName: row.adminName ?? row.adminEmail ?? "Администратор" })),
  };
}

type SofiaCalendarDate = { year: number; month: number; day: number; key: string };
type AdminChartPoint = { key: string; label: string; requestCount: number; requestedValueEur: number; confirmedRequestValueEur: number };
const sofiaTimeZone = "Europe/Sofia";
const padCalendarPart = (value: number) => String(value).padStart(2, "0");
function sofiaCalendarDate(date: Date): SofiaCalendarDate {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: sofiaTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value ?? 0);
  const year = part("year"); const month = part("month"); const day = part("day");
  return { year, month, day, key: `${year}-${padCalendarPart(month)}-${padCalendarPart(day)}` };
}

function mondayKey(date: SofiaCalendarDate) {
  const weekday = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay() || 7;
  const monday = new Date(Date.UTC(date.year, date.month - 1, date.day - (weekday - 1)));
  return `${monday.getUTCFullYear()}-${padCalendarPart(monday.getUTCMonth() + 1)}-${padCalendarPart(monday.getUTCDate())}`;
}

function requestedValueFor(orders: ReportingOrder[]) {
  return orders.filter((order) => order.status !== "cancelled").reduce((sum, order) => sum + Number(order.totalEur ?? 0), 0);
}

function confirmedValueFor(orders: ReportingOrder[]) {
  return orders.filter((order) => order.status === "confirmed" || order.status === "closed").reduce((sum, order) => sum + Number(order.totalEur ?? 0), 0);
}

function dashboardDailySeries(orders: ReportingOrder[], reference: SofiaCalendarDate): AdminChartPoint[] {
  const byDate = new Map<string, ReportingOrder[]>();
  orders.forEach((order) => { const key = sofiaCalendarDate(order.createdAt).key; byDate.set(key, [...(byDate.get(key) ?? []), order]); });
  return Array.from({ length: 14 }, (_, index) => {
    const value = new Date(Date.UTC(reference.year, reference.month - 1, reference.day - (13 - index)));
    const key = `${value.getUTCFullYear()}-${padCalendarPart(value.getUTCMonth() + 1)}-${padCalendarPart(value.getUTCDate())}`;
    const periodOrders = byDate.get(key) ?? [];
    return { key, label: `${padCalendarPart(value.getUTCDate())}.${padCalendarPart(value.getUTCMonth() + 1)}`, requestCount: periodOrders.length, requestedValueEur: requestedValueFor(periodOrders), confirmedRequestValueEur: confirmedValueFor(periodOrders) };
  });
}

function dashboardMonthlySeries(orders: ReportingOrder[], reference: SofiaCalendarDate): AdminChartPoint[] {
  const byMonth = new Map<string, ReportingOrder[]>();
  orders.forEach((order) => { const date = sofiaCalendarDate(order.createdAt); const key = `${date.year}-${padCalendarPart(date.month)}`; byMonth.set(key, [...(byMonth.get(key) ?? []), order]); });
  return Array.from({ length: 12 }, (_, index) => {
    const value = new Date(Date.UTC(reference.year, reference.month - 12 + index, 1));
    const year = value.getUTCFullYear(); const month = value.getUTCMonth() + 1;
    const key = `${year}-${padCalendarPart(month)}`;
    const periodOrders = byMonth.get(key) ?? [];
    const label = new Intl.DateTimeFormat("bg-BG", { month: "short", year: "2-digit", timeZone: sofiaTimeZone }).format(new Date(Date.UTC(year, month - 1, 15))).replace(" ", "");
    return { key, label, requestCount: periodOrders.length, requestedValueEur: requestedValueFor(periodOrders), confirmedRequestValueEur: confirmedValueFor(periodOrders) };
  });
}

export function buildAdminReportingSnapshot(orders: ReportingOrder[], now = new Date()) {
  const reference = sofiaCalendarDate(now);
  const weekStart = mondayKey(reference);
  const periodPredicates = {
    today: (date: SofiaCalendarDate) => date.key === reference.key,
    week: (date: SofiaCalendarDate) => date.key >= weekStart && date.key <= reference.key,
    month: (date: SofiaCalendarDate) => date.year === reference.year && date.month === reference.month,
    year: (date: SofiaCalendarDate) => date.year === reference.year,
  };
  const calculate = (contains: (date: SofiaCalendarDate) => boolean) => {
    const periodOrders = orders.filter((order) => contains(sofiaCalendarDate(order.createdAt)));
    const statusCounts: Record<OrderRequestStatus, number> = { new: 0, contacted: 0, confirmed: 0, closed: 0, cancelled: 0 };
    periodOrders.forEach((order) => { statusCounts[order.status] += 1; });
    return {
      requestCount: periodOrders.length,
      activeRequestCount: statusCounts.new + statusCounts.contacted + statusCounts.confirmed,
      statusCounts,
      requestedValueEur: requestedValueFor(periodOrders),
      confirmedRequestValueEur: confirmedValueFor(periodOrders),
    };
  };
  return { asOf: reference.key, timeZone: sofiaTimeZone, periods: { today: calculate(periodPredicates.today), week: calculate(periodPredicates.week), month: calculate(periodPredicates.month), year: calculate(periodPredicates.year) }, charts: { daily: dashboardDailySeries(orders, reference), monthly: dashboardMonthlySeries(orders, reference) } };
}

export async function logAdminActivity(adminUserId: number, action: string, entityType: string, entityId?: number | null, metadata: Record<string, unknown> = {}) {
  const db = await requireDb();
  await db.insert(adminActivities).values({ adminUserId, action, entityType, entityId: entityId ?? null, metadataJson: JSON.stringify(metadata) });
}
type CatalogueDbLike = any;

async function assertAdminProductSlugAvailableWithDb(db: CatalogueDbLike, slug: string, excludingProductId?: number) {
  const scope = excludingProductId
    ? and(or(eq(catalogueProducts.slug, slug), eq(catalogueProducts.legacyPublicSlug, slug)), ne(catalogueProducts.id, excludingProductId))
    : or(eq(catalogueProducts.slug, slug), eq(catalogueProducts.legacyPublicSlug, slug));
  const [conflict] = await db.select({ id: catalogueProducts.id }).from(catalogueProducts).where(scope!).limit(1);
  if (conflict) throw new Error("Този URL адрес вече е зает от друг продукт или е запазен за стар адрес.");
}

async function assertAdminProductSlugAvailable(slug: string, excludingProductId?: number) {
  const db = await requireDb();
  await assertAdminProductSlugAvailableWithDb(db, slug, excludingProductId);
}

async function validateProductCategorySelection(db: CatalogueDbLike, categoryId: number, selectedSubcategoryIds?: number[]) {
  type LockedCategoryRow = Pick<CategoryRow, "id" | "slug" | "legacyCategoryId" | "legacyParentCategoryId" | "parentId" | "name" | "sortOrder" | "isActive" | "isArchived">;
  const lockedRows: LockedCategoryRow[] = await db.select({ id: catalogueCategories.id, slug: catalogueCategories.slug, legacyCategoryId: catalogueCategories.legacyCategoryId, legacyParentCategoryId: catalogueCategories.legacyParentCategoryId, parentId: catalogueCategories.parentId, name: catalogueCategories.name, sortOrder: catalogueCategories.sortOrder, isActive: catalogueCategories.isActive, isArchived: catalogueCategories.isArchived }).from(catalogueCategories).orderBy(asc(catalogueCategories.id)).for("update");
  const [root] = lockedRows.filter((row) => row.id === categoryId);
  if (!root) throw new Error("Избраната главна категория е невалидна.");
  if (root.isArchived || !root.isActive || root.legacyCategoryId !== null || root.parentId !== null) throw new Error("Избраната главна категория не е активна или е архивирана.");
  const taxonomyRows = lockedRows.filter((row) => row.isArchived === false && (row.legacyCategoryId != null || row.parentId != null));
  const path = validateSelectedSubcategoryPath(taxonomyRows as ProductCategoryTreeRow[], categoryRootsByPublicSlug[root.slug] ?? [], selectedSubcategoryIds, root.id);
  return { root, path };
}

async function insertProductAdminActivity(db: CatalogueDbLike, adminUserId: number, action: string, productId: number, metadata: Record<string, unknown>) {
  await db.insert(adminActivities).values({ adminUserId, action, entityType: "product", entityId: productId, metadataJson: JSON.stringify(metadata) });
}

async function replaceProductSubcategoryLinks(db: CatalogueDbLike, productId: number, path: readonly ProductCategoryTreeRow[]) {
  await db.delete(catalogueProductCategoryLinks).where(eq(catalogueProductCategoryLinks.productId, productId));
  if (path.length) {
    await db.insert(catalogueProductCategoryLinks).values(path.map((row, position) => ({ productId, categoryId: row.id, position })));
  }
}

export async function createAdminProduct(payload: ProductPayload, adminUserId: number) {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    const { path } = await validateProductCategorySelection(tx, payload.categoryId, payload.subcategoryIds);
    await assertAdminProductSlugAvailableWithDb(tx, payload.slug);
    const result = await tx.insert(catalogueProducts).values({
      categoryId: payload.categoryId, slug: payload.slug, sku: payload.sku ?? null, brand: payload.brand ?? null, name: payload.name, description: payload.description, imageUrl: payload.imageUrl, galleryJson: JSON.stringify(payload.gallery), imageAlt: payload.imageAlt, priceEur: asDecimal(payload.priceEur), oldPriceEur: asDecimal(payload.oldPriceEur), discountLabel: payload.discountLabel ?? null, colorName: payload.colorName ?? null, colorRgb: payload.colorRgb ?? null, availability: payload.availability, stockQuantity: payload.stockQuantity, featuresJson: JSON.stringify(payload.features), legacySeoKeywordBg: payload.seoKeywords ?? null, legacyMetaTitleBg: payload.seoTitle ?? null, legacyMetaDescriptionBg: payload.seoDescription ?? null, legacyMetaRobots: payload.seoRobots ?? "index,follow", isActive: payload.isActive,
    });
    const id = Number(result[0].insertId);
    await replaceProductSubcategoryLinks(tx, id, path);
    await insertProductAdminActivity(tx, adminUserId, "product.created", id, { slug: payload.slug, name: payload.name, categoryId: payload.categoryId, subcategoryIds: path.map((row) => row.id) });
    return id;
  });
}

export async function updateAdminProduct(id: number, payload: ProductPayload, adminUserId: number) {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: catalogueProducts.id, slug: catalogueProducts.slug, categoryId: catalogueProducts.categoryId, isArchived: catalogueProducts.isArchived }).from(catalogueProducts).where(eq(catalogueProducts.id, id)).limit(1).for("update");
    if (!existing) throw new Error("Продуктът не е намерен.");
    if (existing.isArchived) throw new Error("Артикулът е архивиран. Възстановете го първо, преди да го редактирате или публикувате.");
    if (existing.slug !== payload.slug) throw new Error("URL адресът на публикуван продукт не се променя, за да се запазят SEO адресите и външните връзки.");
    const { path } = await validateProductCategorySelection(tx, payload.categoryId, payload.subcategoryIds);
    await assertAdminProductSlugAvailableWithDb(tx, payload.slug, id);
    await tx.update(catalogueProducts).set({
      categoryId: payload.categoryId, slug: payload.slug, sku: payload.sku ?? null, brand: payload.brand ?? null, name: payload.name, description: payload.description, imageUrl: payload.imageUrl, galleryJson: JSON.stringify(payload.gallery), imageAlt: payload.imageAlt, priceEur: asDecimal(payload.priceEur), oldPriceEur: asDecimal(payload.oldPriceEur), discountLabel: payload.discountLabel ?? null, colorName: payload.colorName ?? null, colorRgb: payload.colorRgb ?? null, availability: payload.availability, stockQuantity: payload.stockQuantity, featuresJson: JSON.stringify(payload.features), legacySeoKeywordBg: payload.seoKeywords ?? null, legacyMetaTitleBg: payload.seoTitle ?? null, legacyMetaDescriptionBg: payload.seoDescription ?? null, legacyMetaRobots: payload.seoRobots ?? "index,follow", isActive: payload.isActive,
    }).where(eq(catalogueProducts.id, id));
    if (payload.subcategoryIds !== undefined || existing.categoryId !== payload.categoryId) await replaceProductSubcategoryLinks(tx, id, path);
    await insertProductAdminActivity(tx, adminUserId, "product.updated", id, { slug: payload.slug, name: payload.name, categoryId: payload.categoryId, ...(payload.subcategoryIds !== undefined || existing.categoryId !== payload.categoryId ? { subcategoryIds: path.map((row) => row.id) } : {}) });
  });
}

export async function setAdminProductArchived(id: number, archived: boolean, actorId: number) {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    const [product] = await tx.select({ id: catalogueProducts.id, name: catalogueProducts.name, slug: catalogueProducts.slug, sku: catalogueProducts.sku, isArchived: catalogueProducts.isArchived, isActive: catalogueProducts.isActive }).from(catalogueProducts).where(eq(catalogueProducts.id, id)).limit(1).for("update");
    if (!product) throw new Error("Продуктът не е намерен.");
    if (product.isArchived === archived) return { id, isArchived: product.isArchived, isActive: product.isActive };
    await tx.update(catalogueProducts).set({ isArchived: archived, isActive: false }).where(eq(catalogueProducts.id, id));
    await insertProductAdminActivity(tx, actorId, archived ? "product.archived" : "product.restored", id, { name: product.name, slug: product.slug, sku: product.sku ?? null });
    return { id, isArchived: archived, isActive: false };
  });
}

export async function setAdminProductsActive(ids: number[], isActive: boolean, actorId: number) {
  const uniqueIds = Array.from(new Set(ids.filter(id => Number.isInteger(id) && id > 0)));
  if (!uniqueIds.length) throw new Error("Изберете поне един артикул.");
  const db = await requireDb();
  return db.transaction(async tx => {
    const products = await tx.select({ id: catalogueProducts.id, name: catalogueProducts.name, sku: catalogueProducts.sku, slug: catalogueProducts.slug, isActive: catalogueProducts.isActive, isArchived: catalogueProducts.isArchived }).from(catalogueProducts).where(inArray(catalogueProducts.id, uniqueIds)).for("update");
    if (products.length !== uniqueIds.length) throw new Error("Един или повече избрани артикули не са намерени.");
    const editable = products.filter(product => !product.isArchived && product.isActive !== isActive);
    if (editable.length) {
      await tx.update(catalogueProducts).set({ isActive }).where(inArray(catalogueProducts.id, editable.map(product => product.id)));
      await tx.insert(adminActivities).values(editable.map(product => ({ adminUserId: actorId, action: isActive ? "product.published" : "product.unpublished", entityType: "product", entityId: product.id, metadataJson: JSON.stringify({ name: product.name, slug: product.slug, sku: product.sku ?? null }) })));
    }
    return { requested: uniqueIds.length, updated: editable.length, skippedArchived: products.filter(product => product.isArchived).length, isActive };
  });
}

export async function adjustProductStock(id: number, delta: number, adminUserId: number) {
  const db = await requireDb();
  const [product] = await db.select().from(catalogueProducts).where(eq(catalogueProducts.id, id)).limit(1);
  if (!product) throw new Error("Product was not found");
  const stockQuantity = Math.max(0, Math.min(999999, product.stockQuantity + delta));
  const availability: ProductAvailability = stockQuantity > 0 ? "in_stock" : product.availability === "in_stock" ? "on_request" : product.availability;
  await db.update(catalogueProducts).set({ stockQuantity, availability }).where(eq(catalogueProducts.id, id));
  await logAdminActivity(adminUserId, "inventory.adjusted", "product", id, { delta, stockQuantity, availability, slug: product.slug, name: product.name });
  return { id, stockQuantity, availability };
}

export async function saveProductStockChanges(changes: Array<{ id: number; stockQuantity: number }>, adminUserId: number) {
  const db = await requireDb();
  const uniqueChanges = Array.from(new Map(changes.map(change => [change.id, { id: change.id, stockQuantity: Math.max(0, Math.min(999999, Math.trunc(change.stockQuantity))) }])).values());
  if (!uniqueChanges.length) return { changes: [] };
  return db.transaction(async tx => {
    const saved: Array<{ id: number; name: string; oldStockQuantity: number; stockQuantity: number; availability: ProductAvailability }> = [];
    for (const change of uniqueChanges) {
      const [product] = await tx.select({ id: catalogueProducts.id, name: catalogueProducts.name, slug: catalogueProducts.slug, stockQuantity: catalogueProducts.stockQuantity, availability: catalogueProducts.availability, isArchived: catalogueProducts.isArchived }).from(catalogueProducts).where(eq(catalogueProducts.id, change.id)).limit(1).for("update");
      if (!product) throw new Error("Един от избраните артикули не е намерен.");
      if (product.isArchived) throw new Error(`Артикулът „${product.name}“ е архивиран и не може да се променя.`);
      if (product.stockQuantity === change.stockQuantity) continue;
      const availability: ProductAvailability = change.stockQuantity > 0 ? "in_stock" : product.availability === "in_stock" ? "on_request" : product.availability;
      await tx.update(catalogueProducts).set({ stockQuantity: change.stockQuantity, availability }).where(eq(catalogueProducts.id, change.id));
      await tx.insert(adminActivities).values({ adminUserId, action: "inventory.updated", entityType: "product", entityId: change.id, metadataJson: JSON.stringify({ slug: product.slug, name: product.name, oldStockQuantity: product.stockQuantity, stockQuantity: change.stockQuantity, availability }) });
      saved.push({ id: change.id, name: product.name, oldStockQuantity: product.stockQuantity, stockQuantity: change.stockQuantity, availability });
    }
    return { changes: saved };
  });
}

export async function saveProductPromotion(input: { id: number; priceEur: number | null; oldPriceEur: number | null; discountLabel: string | null }, adminUserId: number) {
  const db = await requireDb();
  const [product] = await db.select().from(catalogueProducts).where(eq(catalogueProducts.id, input.id)).limit(1);
  if (!product) throw new Error("Product was not found");
  await db.update(catalogueProducts).set({ priceEur: asDecimal(input.priceEur), oldPriceEur: asDecimal(input.oldPriceEur), discountLabel: input.discountLabel?.trim() || null }).where(eq(catalogueProducts.id, input.id));
  await logAdminActivity(adminUserId, "promotion.updated", "product", input.id, { slug: product.slug, name: product.name, discountLabel: input.discountLabel ?? null });
}

export type PromotionCampaignInput = {
  name: string;
  discountPercent?: number | null;
  fixedPriceEur?: number | null;
  startsAt: string;
  endsAt?: string | null;
  productIds: number[];
  productOverrides?: Array<{ productId: number; discountPercent?: number | null; fixedPriceEur?: number | null; startsAt?: string | null; endsAt?: string | null }>;
};

function campaignStatus(campaign: { isActive: boolean; startsAt: Date; endsAt: Date | null }, now = new Date()) {
  if (!campaign.isActive) return "paused" as const;
  if (campaign.startsAt > now) return "planned" as const;
  if (campaign.endsAt && campaign.endsAt <= now) return "ended" as const;
  return "active" as const;
}

export async function getAdminPromotionCampaigns() {
  const db = await requireDb();
  const [campaignRows, links] = await Promise.all([
    db.select().from(promotionCampaigns).orderBy(desc(promotionCampaigns.startsAt), desc(promotionCampaigns.id)),
    db.select({ campaignId: promotionCampaignProducts.campaignId, productId: promotionCampaignProducts.productId, name: catalogueProducts.name, sku: catalogueProducts.sku, discountPercent: promotionCampaignProducts.discountPercent, fixedPriceEur: promotionCampaignProducts.fixedPriceEur, startsAt: promotionCampaignProducts.startsAt, endsAt: promotionCampaignProducts.endsAt }).from(promotionCampaignProducts).innerJoin(catalogueProducts, eq(promotionCampaignProducts.productId, catalogueProducts.id)),
  ]);
  const now = new Date();
  return campaignRows.map((campaign) => ({
    ...campaign,
    discountPercent: campaign.discountPercent === null ? null : Number(campaign.discountPercent),
    fixedPriceEur: campaign.fixedPriceEur === null ? null : Number(campaign.fixedPriceEur),
    status: campaignStatus(campaign, now),
    products: links.filter((link) => link.campaignId === campaign.id).map(({ productId, name, sku, discountPercent, fixedPriceEur, startsAt, endsAt }) => ({ id: productId, name, sku, discountPercent: discountPercent === null ? null : Number(discountPercent), fixedPriceEur: fixedPriceEur === null ? null : Number(fixedPriceEur), startsAt, endsAt })),
  }));
}

function preparePromotionValues(input: PromotionCampaignInput, products: Array<{ id: number; name: string; priceEur: string | number | null }>) {
  const defaultDiscount = input.discountPercent ?? null;
  const defaultFixedPrice = input.fixedPriceEur ?? null;
  if (defaultDiscount !== null && defaultFixedPrice !== null) throw new Error("Задайте само процент или фиксирана цена като обща стойност.");
  if (defaultDiscount !== null && (!Number.isFinite(defaultDiscount) || defaultDiscount <= 0 || defaultDiscount > 100)) throw new Error("Отстъпката трябва да е между 0.01% и 100%.");
  if (defaultFixedPrice !== null && (!Number.isFinite(defaultFixedPrice) || defaultFixedPrice < 0)) throw new Error("Фиксираната цена трябва да е валидна положителна стойност.");
  const overrides = input.productOverrides ?? [];
  const productById = new Map(products.map((product) => [product.id, product]));
  const links = input.productIds.map((productId) => {
    const product = productById.get(productId);
    const override = overrides.find((item) => item.productId === productId);
    const hasOverrideValue = Boolean(override && (override.discountPercent !== undefined || override.fixedPriceEur !== undefined));
    const discountPercent = hasOverrideValue ? (override?.discountPercent ?? null) : defaultDiscount;
    const fixedPriceEur = hasOverrideValue ? (override?.fixedPriceEur ?? null) : defaultFixedPrice;
    if (!product) throw new Error("Един или повече избрани артикули не са намерени.");
    if ((discountPercent === null) === (fixedPriceEur === null)) throw new Error(`Задайте точно една стойност за „${product.name}“.`);
    if (discountPercent !== null && (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100)) throw new Error("Всеки процент трябва да е между 0.01% и 100%.");
    const basePrice = Number(product.priceEur);
    if (fixedPriceEur !== null && (!Number.isFinite(fixedPriceEur) || fixedPriceEur < 0 || fixedPriceEur > basePrice)) throw new Error(`Фиксираната цена за „${product.name}“ не може да е над базовата цена.`);
    const startsAt = override?.startsAt ? new Date(override.startsAt) : null;
    const endsAt = override?.endsAt ? new Date(override.endsAt) : null;
    const effectiveStartsAt = startsAt ?? new Date(input.startsAt);
    if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime())) || effectiveStartsAt.toString() === "Invalid Date" || (endsAt && endsAt <= effectiveStartsAt)) throw new Error(`Невалиден период за „${product.name}“.`);
    return { productId, discountPercent: asDecimal(discountPercent), fixedPriceEur: asDecimal(fixedPriceEur), startsAt, endsAt };
  });
  return { defaultDiscount, defaultFixedPrice, links };
}

export async function createPromotionCampaign(input: PromotionCampaignInput, adminUserId: number) {
  const name = input.name.trim();
  const productIds: number[] = Array.from(new Set(input.productIds.length ? input.productIds : (input.productOverrides ?? []).map((item) => item.productId)));
  const startsAt = new Date(input.startsAt);
  const endsAt = input.endsAt ? new Date(input.endsAt) : null;
  if (!name) throw new Error("Името на промоцията е задължително.");
  if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime()))) throw new Error("Невалиден период на промоцията.");
  if (endsAt && endsAt <= startsAt) throw new Error("Крайната дата трябва да е след началната дата.");
  if (!productIds.length) throw new Error("Изберете поне един артикул.");
  const db = await requireDb();
  return db.transaction(async (tx) => {
    const products = await tx.select({ id: catalogueProducts.id, name: catalogueProducts.name, sku: catalogueProducts.sku, priceEur: catalogueProducts.priceEur, isActive: catalogueProducts.isActive, isArchived: catalogueProducts.isArchived }).from(catalogueProducts).where(inArray(catalogueProducts.id, productIds));
    if (products.length !== productIds.length) throw new Error("Един или повече избрани артикули не са намерени.");
    if (products.some((product) => !product.isActive || product.isArchived || product.priceEur === null)) throw new Error("Промоция може да се добави само към активни артикули с базова цена.");
    const { defaultDiscount, defaultFixedPrice, links } = preparePromotionValues({ ...input, productIds }, products);
    const inserted = await tx.insert(promotionCampaigns).values({ name, discountPercent: asDecimal(defaultDiscount), fixedPriceEur: asDecimal(defaultFixedPrice), startsAt, endsAt, isActive: true, createdBy: adminUserId });
    const campaignId = Number(inserted[0].insertId);
    await tx.insert(promotionCampaignProducts).values(links.map((row) => ({ ...row, campaignId })));
    await tx.insert(adminActivities).values({ adminUserId, action: "promotion.campaign.created", entityType: "promotion_campaign", entityId: campaignId, metadataJson: JSON.stringify({ name, discountPercent: defaultDiscount, fixedPriceEur: defaultFixedPrice, startsAt, endsAt, productIds }) });
    return { id: campaignId, productCount: productIds.length };
  });
}

export async function updatePromotionCampaign(id: number, input: PromotionCampaignInput, adminUserId: number) {
  const name = input.name.trim();
  const productIds = Array.from(new Set(input.productIds));
  const startsAt = new Date(input.startsAt);
  const endsAt = input.endsAt ? new Date(input.endsAt) : null;
  if (!name) throw new Error("Името на промоцията е задължително.");
  if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime())) || (endsAt && endsAt <= startsAt)) throw new Error("Невалиден период на промоцията.");
  if (!productIds.length) throw new Error("Изберете поне един артикул.");
  const db = await requireDb();
  return db.transaction(async (tx) => {
    const [campaign] = await tx.select({ id: promotionCampaigns.id, isActive: promotionCampaigns.isActive }).from(promotionCampaigns).where(eq(promotionCampaigns.id, id)).limit(1);
    if (!campaign) throw new Error("Промоцията не е намерена.");
    const products = await tx.select({ id: catalogueProducts.id, name: catalogueProducts.name, sku: catalogueProducts.sku, priceEur: catalogueProducts.priceEur, isActive: catalogueProducts.isActive, isArchived: catalogueProducts.isArchived }).from(catalogueProducts).where(inArray(catalogueProducts.id, productIds));
    if (products.length !== productIds.length || products.some((product) => !product.isActive || product.isArchived || product.priceEur === null)) throw new Error("Промоция може да се добави само към активни артикули с базова цена.");
    const { defaultDiscount, defaultFixedPrice, links } = preparePromotionValues({ ...input, productIds }, products);
    await tx.update(promotionCampaigns).set({ name, discountPercent: asDecimal(defaultDiscount), fixedPriceEur: asDecimal(defaultFixedPrice), startsAt, endsAt }).where(eq(promotionCampaigns.id, id));
    await tx.delete(promotionCampaignProducts).where(eq(promotionCampaignProducts.campaignId, id));
    await tx.insert(promotionCampaignProducts).values(links.map((row) => ({ ...row, campaignId: id })));
    await tx.insert(adminActivities).values({ adminUserId, action: "promotion.campaign.updated", entityType: "promotion_campaign", entityId: id, metadataJson: JSON.stringify({ name, discountPercent: defaultDiscount, fixedPriceEur: defaultFixedPrice, startsAt, endsAt, productIds }) });
    return { id, productCount: productIds.length, isActive: campaign.isActive };
  });
}

export async function deletePromotionCampaign(id: number, adminUserId: number) {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    const [campaign] = await tx.select({ id: promotionCampaigns.id, name: promotionCampaigns.name }).from(promotionCampaigns).where(eq(promotionCampaigns.id, id)).limit(1);
    if (!campaign) throw new Error("Промоцията не е намерена.");
    await tx.delete(promotionCampaignProducts).where(eq(promotionCampaignProducts.campaignId, id));
    await tx.delete(promotionCampaigns).where(eq(promotionCampaigns.id, id));
    await tx.insert(adminActivities).values({ adminUserId, action: "promotion.campaign.deleted", entityType: "promotion_campaign", entityId: id, metadataJson: JSON.stringify({ name: campaign.name }) });
    return { id, deleted: true };
  });
}

export async function setPromotionCampaignActive(id: number, isActive: boolean, adminUserId: number) {
  const db = await requireDb();
  const [campaign] = await db.select({ id: promotionCampaigns.id, name: promotionCampaigns.name }).from(promotionCampaigns).where(eq(promotionCampaigns.id, id)).limit(1);
  if (!campaign) throw new Error("Промоцията не е намерена.");
  await db.update(promotionCampaigns).set({ isActive }).where(eq(promotionCampaigns.id, id));
  await logAdminActivity(adminUserId, isActive ? "promotion.campaign.activated" : "promotion.campaign.paused", "promotion_campaign", id, { name: campaign.name });
  return { id, isActive };
}

function categoryDepthAndParent(rows: CategoryRow[], id: number) {
  const meta = categoryMeta(rows).get(id);
  return { parentId: meta?.parentId ?? null, rootId: meta?.rootId ?? null, depth: meta?.depth ?? 0, isMain: meta?.isMain ?? false };
}

function assertCategoryParentInPublicTree(rows: CategoryRow[], parentId: number | null, editingId?: number) {
  if (parentId == null) return;
  if (editingId === parentId) throw new Error("Категорията не може да бъде свой родител.");
  const meta = categoryMeta(rows);
  const parent = rows.find((row) => row.id === parentId);
  if (!parent || !hasPublicCategoryBranch(parent, rows, meta)) throw new Error("Родителят не принадлежи към публичното дърво.");
  const parentInfo = meta.get(parent.id);
  if (!parentInfo || parentInfo.depth >= 4) throw new Error("Категориите могат да имат най-много четири нива на деца.");
  if (editingId != null && parentInfo.path.some((row) => row.id === editingId)) throw new Error("Не може да се създаде цикъл в категорийното дърво.");
}

async function assertCategorySlugAvailable(db: CatalogueDbLike, slug: string, excludingId?: number) {
  const scope = excludingId ? and(eq(catalogueCategories.slug, slug), ne(catalogueCategories.id, excludingId)) : eq(catalogueCategories.slug, slug);
  const [conflict] = await db.select({ id: catalogueCategories.id }).from(catalogueCategories).where(scope).limit(1);
  if (conflict) throw new Error("Този URL адрес вече се използва от друга категория.");
}

async function categoryHasDependants(db: CatalogueDbLike, id: number) {
  const [product] = await db.select({ id: catalogueProducts.id }).from(catalogueProducts).where(eq(catalogueProducts.categoryId, id)).limit(1);
  if (product) return true;
  const [link] = await db.select({ id: catalogueProductCategoryLinks.id }).from(catalogueProductCategoryLinks).where(eq(catalogueProductCategoryLinks.categoryId, id)).limit(1);
  return Boolean(link);
}

export async function saveAdminCategory(id: number | undefined, payload: CategoryPayload, adminUserId: number) {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(catalogueCategories).orderBy(asc(catalogueCategories.id)).for("update");
    const existing = id == null ? undefined : rows.find((row) => row.id === id);
    if (id != null && !existing) throw new Error("Категорията не е намерена.");
    if (existing?.isArchived) throw new Error("Архивирана категория не може да бъде записвана от остарял чернови запис. Възстановете я първо.");
    const meta = categoryMeta(rows);
    const current = existing ? categoryDepthAndParent(rows, existing.id) : { parentId: null, rootId: null, depth: -1, isMain: true };
    const desiredParentId = payload.parentId === undefined ? current.parentId : payload.parentId;
    assertCategoryParentInPublicTree(rows, desiredParentId, id);
    const desiredIsMain = desiredParentId == null;
    if (desiredIsMain && !payload.imageUrl) throw new Error("Главната категория изисква снимка.");
    if (existing && existing.legacyCategoryId != null && desiredParentId !== current.parentId) throw new Error("Родителят на внесена legacy категория не може да се променя.");
    if (existing && existing.legacyCategoryId != null && current.parentId == null && desiredIsMain) throw new Error("Типът на внесена legacy категория не може да се променя.");
    if (existing && desiredParentId !== current.parentId && (await categoryHasDependants(tx, existing.id) || rows.some((row) => categoryDepthAndParent(rows, row.id).parentId === existing.id))) throw new Error("Типът или родителят на категория с деца или свързани продукти не може да се променя.");
    if (existing && existing.legacyCategoryId == null && existing.parentId == null && categoryRootsByPublicSlug[existing.slug] && existing.slug !== payload.slug) throw new Error("URL адресът на legacy публична главна категория не може да се променя.");
    await assertCategorySlugAvailable(tx, payload.slug, id);
    const subcategoriesJson = payload.subcategories === undefined ? undefined : JSON.stringify(payload.subcategories);
    const values = { slug: payload.slug, name: payload.name, description: payload.description, imageUrl: payload.imageUrl, icon: payload.icon, sortOrder: payload.sortOrder, isActive: payload.isActive, ...(subcategoriesJson === undefined ? {} : { subcategoriesJson }), ...(existing ? {} : { parentId: desiredParentId }) };
    if (existing) {
      await tx.update(catalogueCategories).set({ ...values, ...(existing.legacyCategoryId == null ? { parentId: desiredParentId } : {}) }).where(eq(catalogueCategories.id, existing.id));
      await tx.insert(adminActivities).values({ adminUserId, action: "category.updated", entityType: "category", entityId: existing.id, metadataJson: JSON.stringify({ slug: payload.slug, name: payload.name, parentId: desiredParentId }) });
      return existing.id;
    }
    const result = await tx.insert(catalogueCategories).values({ ...values, parentId: desiredParentId, legacyCategoryId: null, legacyParentCategoryId: null, subcategoriesJson: subcategoriesJson ?? "[]" });
    const categoryId = Number(result[0].insertId);
    await tx.insert(adminActivities).values({ adminUserId, action: "category.created", entityType: "category", entityId: categoryId, metadataJson: JSON.stringify({ slug: payload.slug, name: payload.name, parentId: desiredParentId }) });
    return categoryId;
  });
}

/**
 * Archives a category without deleting or rewriting any product data.  The full
 * category row set is locked in one deterministic order so category saves and
 * product assignments cannot create/reparent a dependency while these guards
 * are being evaluated.
 */
export async function setAdminCategoryArchived(id: number, archived: boolean, actorId: number) {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(catalogueCategories).orderBy(asc(catalogueCategories.id)).for("update");
    const category = rows.find((row) => row.id === id);
    if (!category) throw new TRPCError({ code: "NOT_FOUND", message: "Категорията не е намерена." });

    if (category.isArchived === archived) {
      return { id, isArchived: category.isArchived, isActive: category.isActive };
    }

    const meta = categoryMeta(rows);
    if (!archived) {
      const parentId = effectiveParentId(category, rows);
      const requiresParent = category.parentId != null || category.legacyParentCategoryId != null;
      const parent = parentId == null ? undefined : rows.find((row) => row.id === parentId);
      if (requiresParent && (!parent || parent.isArchived)) throw new TRPCError({ code: "CONFLICT", message: "Категорията не може да бъде възстановена, защото родителят липсва или е архивиран." });
    } else {
      const info = meta.get(category.id);
      if (category.legacyCategoryId != null && !info?.rootId) throw new TRPCError({ code: "CONFLICT", message: "Тази техническа категория от структурата на каталога не може да бъде премахната самостоятелно." });

      const realChildren = rows.filter((row) => row.id !== id && effectiveParentId(row, rows) === id && (row.legacyCategoryId != null || row.parentId != null));
      if (realChildren.some((row) => !row.isArchived)) throw new TRPCError({ code: "CONFLICT", message: "Категорията съдържа непремахнати подкатегории. Премахнете ги първо." });
      if (!realChildren.length && parseCategoryTree(category.subcategoriesJson).length > 0) throw new TRPCError({ code: "CONFLICT", message: "Категорията съдържа подкатегории, записани в старата структура. Първо трябва да бъде прегледана структурата ѝ." });

      const [product] = await tx.select({ id: catalogueProducts.id }).from(catalogueProducts).where(eq(catalogueProducts.categoryId, id)).limit(1);
      if (product) throw new TRPCError({ code: "CONFLICT", message: "Категорията не може да бъде премахната: има свързани продукти. Преместете ги в друга категория първо." });
      const [link] = await tx.select({ id: catalogueProductCategoryLinks.id }).from(catalogueProductCategoryLinks).where(eq(catalogueProductCategoryLinks.categoryId, id)).limit(1);
      if (link) throw new TRPCError({ code: "CONFLICT", message: "Категорията не може да бъде премахната: има свързани продуктови връзки. Преместете артикулите в друга подкатегория първо." });
    }

    await tx.update(catalogueCategories).set({ isArchived: archived, isActive: false }).where(eq(catalogueCategories.id, id));
    await tx.insert(adminActivities).values({
      adminUserId: actorId,
      action: archived ? "category.archived" : "category.restored",
      entityType: "category",
      entityId: id,
      metadataJson: JSON.stringify({ name: category.name, slug: category.slug, isArchived: archived }),
    });
    return { id, isArchived: archived, isActive: false };
  });
}

export async function updateOrderRequest(id: number, status: OrderRequestStatus, adminNote: string | null, adminUserId: number, adminName: string) {
  const db = await requireDb();
  const comment = adminNote?.trim() || null;
  const authorName = adminName.trim().slice(0, 255) || "Администратор";
  await db.transaction(async (tx) => {
    const [order] = await tx.select({ id: orderRequests.id, isDeleted: orderRequests.isDeleted }).from(orderRequests).where(eq(orderRequests.id, id)).limit(1).for("update");
    if (!order) throw new Error("Поръчката не е намерена.");
    if (order.isDeleted) throw new Error("Поръчката е изтрита и не може да се променя.");
    await tx.update(orderRequests).set({ status, adminNote: comment }).where(eq(orderRequests.id, id));
    await tx.insert(orderStatusHistory).values({ orderRequestId: id, status, comment, authorId: adminUserId, authorName });
    await tx.insert(adminActivities).values({ adminUserId, action: "order.updated", entityType: "order_request", entityId: id, metadataJson: JSON.stringify({ status }) });
  });
}

export async function updateContactEnquiry(id: number, status: ContactEnquiryStatus, adminNote: string | null, adminUserId: number, adminName: string) {
  const db = await requireDb();
  const comment = adminNote?.trim() || null;
  const authorName = adminName.trim().slice(0, 255) || "Администратор";
  await db.transaction(async tx => {
    const [enquiry] = await tx.select({ id: contactEnquiries.id, isDeleted: contactEnquiries.isDeleted }).from(contactEnquiries).where(eq(contactEnquiries.id, id)).limit(1).for("update");
    if (!enquiry) throw new Error("Запитването не е намерено.");
    if (enquiry.isDeleted) throw new Error("Запитването е изтрито и не може да се променя.");
    await tx.update(contactEnquiries).set({ status, adminNote: comment }).where(eq(contactEnquiries.id, id));
    await tx.insert(contactEnquiryHistory).values({ contactEnquiryId: id, status, comment, authorId: adminUserId, authorName });
    await tx.insert(adminActivities).values({ adminUserId, action: "contact_enquiry.updated", entityType: "contact_enquiry", entityId: id, metadataJson: JSON.stringify({ status }) });
  });
}

export async function deleteOrderRequest(id: number, adminUserId: number, adminName: string) {
  const db = await requireDb();
  await db.transaction(async tx => {
    const [order] = await tx.select({ id: orderRequests.id, requestNumber: orderRequests.requestNumber, isDeleted: orderRequests.isDeleted }).from(orderRequests).where(eq(orderRequests.id, id)).limit(1).for("update");
    if (!order) throw new Error("Поръчката не е намерена.");
    if (order.isDeleted) return;
    await tx.update(orderRequests).set({ isDeleted: true }).where(eq(orderRequests.id, id));
    await tx.insert(adminActivities).values({ adminUserId, action: "order.deleted", entityType: "order_request", entityId: id, metadataJson: JSON.stringify({ requestNumber: order.requestNumber, actorName: adminName }) });
  });
}

export async function deleteContactEnquiry(id: number, adminUserId: number, adminName: string) {
  const db = await requireDb();
  await db.transaction(async tx => {
    const [enquiry] = await tx.select({ id: contactEnquiries.id, referenceNumber: contactEnquiries.referenceNumber, isDeleted: contactEnquiries.isDeleted }).from(contactEnquiries).where(eq(contactEnquiries.id, id)).limit(1).for("update");
    if (!enquiry) throw new Error("Запитването не е намерено.");
    if (enquiry.isDeleted) return;
    await tx.update(contactEnquiries).set({ isDeleted: true }).where(eq(contactEnquiries.id, id));
    await tx.insert(adminActivities).values({ adminUserId, action: "contact_enquiry.deleted", entityType: "contact_enquiry", entityId: id, metadataJson: JSON.stringify({ referenceNumber: enquiry.referenceNumber, actorName: adminName }) });
  });
}

export type OrderRequestItemInput = { productSlug: string; quantity: number };
export type OrderRequestInput = {
  items?: OrderRequestItemInput[];
  productSlug?: string;
  quantity?: number;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  region?: string;
  city: string;
  postcode: string;
  invoiceRequested?: boolean;
  invoiceCompanyName?: string | null;
  invoiceEik?: string | null;
  invoiceVatNumber?: string | null;
  invoiceMol?: string | null;
  invoiceRegion?: string | null;
  invoiceCity?: string | null;
  invoicePostcode?: string | null;
  invoiceAddress?: string | null;
  invoiceAddressAdditional?: string | null;
  invoiceAdditionalInfo?: string | null;
};

export async function createOrderRequest(input: OrderRequestInput) {
  await ensureCatalogueSeeded();
  const db = await requireDb();
  const requestedItems = input.items?.length ? input.items : input.productSlug && input.quantity ? [{ productSlug: input.productSlug, quantity: input.quantity }] : [];
  if (!requestedItems.length) throw new Error("At least one product is required");
  const requestNumber = `J-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 5).toUpperCase()}`;
  return db.transaction(async (tx) => {
    const products = await tx.select().from(catalogueProducts).where(and(inArray(catalogueProducts.slug, requestedItems.map((item) => item.productSlug)), eq(catalogueProducts.isActive, true), ne(catalogueProducts.availability, "out_of_stock")));
    const productBySlug = new Map(products.map((product) => [product.slug, product]));
    const resolvedItems = requestedItems.map((item) => {
      const product = productBySlug.get(item.productSlug);
      if (!product) throw new Error("One or more products are unavailable");
      const price = product.priceEur ? Number(product.priceEur) : null;
      return { product, quantity: item.quantity, price, total: price === null ? null : price * item.quantity };
    });
    const totalQuantity = resolvedItems.reduce((sum, item) => sum + item.quantity, 0);
    const total = resolvedItems.every((item) => item.total !== null) ? resolvedItems.reduce((sum, item) => sum + (item.total ?? 0), 0) : null;
    const first = resolvedItems[0];
    const [header] = await tx.insert(orderRequests).values({
      requestNumber, productId: first.product.id, productName: resolvedItems.length > 1 ? `${first.product.name} + още ${resolvedItems.length - 1}` : first.product.name, productSku: first.product.sku, productImageUrl: first.product.imageUrl, quantity: totalQuantity, priceEur: resolvedItems.length === 1 ? asDecimal(first.price) : null, totalEur: asDecimal(total), fullName: input.fullName, email: input.email, phone: input.phone, address: input.address, region: input.region ?? null, city: input.city, postcode: input.postcode, invoiceRequested: input.invoiceRequested ?? false, invoiceCompanyName: input.invoiceRequested ? input.invoiceCompanyName?.trim() || null : null, invoiceEik: input.invoiceRequested ? input.invoiceEik?.trim() || null : null, invoiceVatNumber: input.invoiceRequested ? input.invoiceVatNumber?.trim() || null : null, invoiceMol: input.invoiceRequested ? input.invoiceMol?.trim() || null : null, invoiceRegion: input.invoiceRequested ? input.invoiceRegion?.trim() || null : null, invoiceCity: input.invoiceRequested ? input.invoiceCity?.trim() || null : null, invoicePostcode: input.invoiceRequested ? input.invoicePostcode?.trim() || null : null, invoiceAddress: input.invoiceRequested ? input.invoiceAddress?.trim() || null : null, invoiceAddressAdditional: input.invoiceRequested ? input.invoiceAddressAdditional?.trim() || null : null, invoiceAdditionalInfo: input.invoiceRequested ? input.invoiceAdditionalInfo?.trim() || null : null, status: "new", adminNote: null,
    });
    const orderRequestId = Number(header.insertId);
    await tx.insert(orderRequestItems).values(resolvedItems.map((item) => ({ orderRequestId, productId: item.product.id, productName: item.product.name, productSku: item.product.sku, productImageUrl: item.product.imageUrl, quantity: item.quantity, priceEur: asDecimal(item.price), totalEur: asDecimal(item.total) })));
    return { requestNumber, itemCount: resolvedItems.length };
  });
}

export async function createContactEnquiry(input: { fullName: string; email: string; phone?: string | null; subject: string; message: string }) {
  const db = await requireDb();
  const referenceNumber = `C-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 5).toUpperCase()}`;
  await db.transaction(async tx => {
    const [created] = await tx.insert(contactEnquiries).values({ referenceNumber, fullName: input.fullName, email: input.email, phone: input.phone?.trim() || null, subject: input.subject, message: input.message, status: "new", adminNote: null });
    await tx.insert(contactEnquiryHistory).values({ contactEnquiryId: Number(created.insertId), status: "new", comment: null, authorId: null, authorName: "Публична форма" });
  });
  try {
    await notifyOwner({ title: `Ново контактно запитване ${referenceNumber}`, content: `${input.fullName} (${input.email})${input.phone ? `, ${input.phone}` : ""}: ${input.subject}\n${input.message}` });
  } catch (error) {
    console.warn("[Contact] Owner notification unavailable; enquiry remains stored:", error);
  }
  return { referenceNumber };
}

export async function uploadProductImage(input: { dataUrl: string; fileName: string }, adminUserId: number) {
  const match = input.dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Only JPEG, PNG, and WEBP image uploads are supported");
  const contentType = match[1] as "image/jpeg" | "image/png" | "image/webp";
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > 10 * 1024 * 1024) throw new Error("Image files must be between 1 byte and 10 MB");
  assertUploadSignature(bytes, contentType);
  const extension = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1];
  const safeName = input.fileName.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 80) || "product";
  const stored = await storagePut(`catalogue/admin/${safeName}.${extension}`, bytes, contentType);
  await logAdminActivity(adminUserId, "product_image.uploaded", "product_image", null, { key: stored.key });
  return stored;
}


export async function uploadCategoryImage(input: { dataUrl: string; fileName: string }, adminUserId: number) {
  const match = input.dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Поддържат се само JPEG, PNG и WEBP снимки.");
  const contentType = match[1] as "image/jpeg" | "image/png" | "image/webp";
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > 10 * 1024 * 1024) throw new Error("Снимката трябва да е между 1 байт и 10 MB.");
  assertUploadSignature(bytes, contentType);
  const extension = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1];
  const safeName = input.fileName.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 80) || "category";
  const stored = await storagePut(`catalogue/categories/${safeName}.${extension}`, bytes, contentType);
  await logAdminActivity(adminUserId, "category_image.uploaded", "category_asset", null, { key: stored.key, contentType, bytes: bytes.length });
  return stored;
}

function decodeDataUrl(dataUrl: string, expression: RegExp, message: string) {
  const match = dataUrl.match(expression);
  if (!match) throw new Error(message);
  return Buffer.from(match[1], "base64");
}

export function assertUploadSignature(bytes: Buffer, contentType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf") {
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  const isPdf = bytes.length >= 4 && bytes.subarray(0, 4).toString("ascii") === "%PDF";
  const isValid = contentType === "image/jpeg" ? isJpeg : contentType === "image/png" ? isPng : contentType === "image/webp" ? isWebp : isPdf;
  if (!isValid) throw new Error("The uploaded file content does not match its declared type");
}

function safeBrochureName(fileName: string, fallback: string) {
  return fileName.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 80) || fallback;
}

export async function uploadAdminBrochure(input: BrochureUploadPayload, adminUserId: number) {
  if (input.pages.length === 0 || input.pages.length > 16) throw new Error("Brochures must contain between 1 and 16 rendered pages");
  const reference = randomUUID();
  let sourcePdf: { key: string; url: string } | null = null;
  if (input.sourcePdf) {
    const pdfBytes = decodeDataUrl(input.sourcePdf.dataUrl, /^data:(?:application|binary)\/(?:pdf|octet-stream);base64,([A-Za-z0-9+/=]+)$/, "A valid PDF brochure is required");
    if (pdfBytes.length === 0 || pdfBytes.length > 20 * 1024 * 1024) throw new Error("PDF brochures must be between 1 byte and 20 MB");
    assertUploadSignature(pdfBytes, "application/pdf");
    const safePdfName = safeBrochureName(input.sourcePdf.fileName.replace(/\.pdf$/i, ""), "brochure");
    sourcePdf = await storagePut(`brochures/${reference}/${safePdfName}.pdf`, pdfBytes, "application/pdf");
  }
  const pageUrls: string[] = [];
  for (let index = 0; index < input.pages.length; index += 1) {
    const page = input.pages[index];
    const pageBytes = decodeDataUrl(page.dataUrl, /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/, "Brochure pages must be JPEG images");
    if (pageBytes.length === 0 || pageBytes.length > 3 * 1024 * 1024) throw new Error("Each brochure page must be between 1 byte and 3 MB");
    assertUploadSignature(pageBytes, "image/jpeg");
    const safePageName = safeBrochureName(page.fileName.replace(/\.(jpg|jpeg)$/i, ""), `page-${index + 1}`);
    const stored = await storagePut(`brochures/${reference}/${String(index + 1).padStart(2, "0")}-${safePageName}.jpg`, pageBytes, "image/jpeg");
    pageUrls.push(stored.url);
  }
  const db = await requireDb();
  const result = await db.insert(catalogueBrochures).values({ title: input.title.trim(), sourcePdfKey: sourcePdf?.key ?? null, sourcePdfUrl: sourcePdf?.url ?? null, pageUrlsJson: JSON.stringify(pageUrls), pageCount: pageUrls.length, isActive: false, isArchived: false });
  const id = Number(result[0].insertId);
  await logAdminActivity(adminUserId, "brochure.uploaded", "brochure", id, { title: input.title.trim(), pageCount: pageUrls.length, sourcePdfKey: sourcePdf?.key ?? null });
  return { id, pageCount: pageUrls.length };
}

export async function uploadBrochurePage(input: { dataUrl: string; fileName: string }, adminUserId: number) {
  const pageBytes = decodeDataUrl(input.dataUrl, /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/, "Brochure pages must be JPEG images");
  if (pageBytes.length === 0 || pageBytes.length > 3 * 1024 * 1024) throw new Error("Each brochure page must be between 1 byte and 3 MB");
  assertUploadSignature(pageBytes, "image/jpeg");
  const safePageName = safeBrochureName(input.fileName.replace(/\.(jpg|jpeg)$/i, ""), "brochure-page");
  const stored = await storagePut(`brochures/pages/${randomUUID()}-${safePageName}.jpg`, pageBytes, "image/jpeg");
  await logAdminActivity(adminUserId, "brochure.page_uploaded", "brochure_page", null, { key: stored.key });
  return stored;
}

export async function activateAdminBrochure(id: number, adminUserId: number) {
  const db = await requireDb();
  const [brochure] = await db.select().from(catalogueBrochures).where(eq(catalogueBrochures.id, id)).limit(1);
  if (!brochure || brochure.isArchived) throw new Error("Brochure is unavailable for activation");
  await db.transaction(async (tx) => {
    await tx.update(catalogueBrochures).set({ isActive: false }).where(eq(catalogueBrochures.isActive, true));
    await tx.update(catalogueBrochures).set({ isActive: true, isArchived: false }).where(eq(catalogueBrochures.id, id));
  });
  await logAdminActivity(adminUserId, "brochure.activated", "brochure", id, { title: brochure.title, pageCount: brochure.pageCount });
}

export async function replaceAdminBrochure(input: BrochureReplacementPayload, adminUserId: number) {
  if (input.pageUrls.length === 0 || input.pageUrls.length > 16 || input.pageUrls.some((url) => !url.startsWith("/manus-storage/"))) throw new Error("Brochure replacement requires between 1 and 16 managed page images");
  const db = await requireDb();
  const result = await db.insert(catalogueBrochures).values({ title: input.title.trim(), sourcePdfKey: null, sourcePdfUrl: null, pageUrlsJson: JSON.stringify(input.pageUrls), pageCount: input.pageUrls.length, isActive: false, isArchived: false });
  const id = Number(result[0].insertId);
  await logAdminActivity(adminUserId, "brochure.uploaded", "brochure", id, { title: input.title.trim(), pageCount: input.pageUrls.length, sourcePdfKey: null });
  await activateAdminBrochure(id, adminUserId);
  await logAdminActivity(adminUserId, "brochure.replaced", "brochure", id, { title: input.title.trim(), pageCount: input.pageUrls.length });
  return { id, pageCount: input.pageUrls.length };
}

export async function archiveAdminBrochure(id: number, adminUserId: number) {
  const db = await requireDb();
  const [brochure] = await db.select().from(catalogueBrochures).where(eq(catalogueBrochures.id, id)).limit(1);
  if (!brochure) throw new Error("Brochure was not found");
  if (brochure.isActive) throw new Error("Activate another brochure before archiving the current one");
  await db.update(catalogueBrochures).set({ isArchived: true }).where(eq(catalogueBrochures.id, id));
  await logAdminActivity(adminUserId, "brochure.archived", "brochure", id, { title: brochure.title });
}

import { and, asc, count, countDistinct, desc, eq, gte, inArray, isNull, like, lte, ne, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { categories as seedCategories, products as seedProducts } from "../client/src/lib/storeData";
import { adminActivities, catalogueBrochures, catalogueCategories, catalogueProductCategoryLinks, catalogueProducts, contactEnquiries, orderRequests, users } from "../drizzle/schema";
import { getDb } from "./db";
import { storagePut } from "./storage";

export type ProductAvailability = "in_stock" | "on_request" | "out_of_stock";
export type OrderRequestStatus = "new" | "contacted" | "confirmed" | "closed" | "cancelled";
export type ContactEnquiryStatus = "new" | "contacted" | "closed";
export type CategoryNode = { label: string; children?: CategoryNode[] };
type ReportingOrder = Pick<typeof orderRequests.$inferSelect, "createdAt" | "status" | "totalEur">;

export type ProductPayload = {
  categoryId: number;
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
  availability: ProductAvailability;
  stockQuantity: number;
  features: string[];
  isActive: boolean;
};

export type CategoryPayload = {
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
  icon: string;
  subcategories: CategoryNode[];
  sortOrder: number;
  isActive: boolean;
};

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

function publicCategory(category: typeof catalogueCategories.$inferSelect) {
  return {
    id: category.id,
    slug: category.slug,
    label: category.name,
    description: category.description,
    image: category.imageUrl,
    icon: category.icon,
    subcategories: parseCategoryTree(category.subcategoriesJson),
    metaTitle: category.legacyMetaTitleBg ?? undefined,
    metaDescription: category.legacyMetaDescriptionBg ?? undefined,
    canonicalUrl: category.legacyCanonicalUrl ?? undefined,
    metaRobots: category.legacyMetaRobots ?? undefined,
  };
}

function publicProduct(product: typeof catalogueProducts.$inferSelect, category: typeof catalogueCategories.$inferSelect) {
  return {
    id: product.id,
    slug: product.slug,
    legacyPublicSlug: product.legacyPublicSlug ?? undefined,
    sku: product.sku ?? undefined,
    brand: product.brand ?? undefined,
    name: product.name,
    image: product.imageUrl,
    gallery: parseJsonArray(product.galleryJson),
    imageAlt: product.imageAlt,
    price: formatPrice(product.priceEur),
    oldPrice: formatPrice(product.oldPriceEur),
    discount: product.discountLabel ?? undefined,
    category: category.slug,
    availability: availabilityLabels[product.availability],
    availabilityCode: product.availability,
    stockQuantity: product.stockQuantity,
    features: publicProductFeatures(product.featuresJson),
    description: product.description,
    isActive: product.isActive,
    metaTitle: product.legacyMetaTitleBg ?? undefined,
    metaDescription: product.legacyMetaDescriptionBg ?? undefined,
    canonicalUrl: product.legacyCanonicalUrl ?? undefined,
    metaRobots: product.legacyMetaRobots ?? undefined,
  };
}

function publicBrochure(brochure: typeof catalogueBrochures.$inferSelect) {
  const pageUrls = parseJsonArray(brochure.pageUrlsJson);
  return { id: brochure.id, title: brochure.title, pageUrls, pageCount: brochure.pageCount, sourcePdfUrl: brochure.sourcePdfUrl, isActive: brochure.isActive, isArchived: brochure.isArchived, createdAt: brochure.createdAt, updatedAt: brochure.updatedAt, isManaged: true };
}

export async function getPublicBrochure() {
  await ensureBrochureSeeded();
  const db = await requireDb();
  const [brochure] = await db.select().from(catalogueBrochures).where(and(eq(catalogueBrochures.isActive, true), eq(catalogueBrochures.isArchived, false))).orderBy(desc(catalogueBrochures.updatedAt)).limit(1);
  return brochure ? publicBrochure(brochure) : { id: 0, title: "Промо брошура", pageUrls: fallbackBrochurePages, pageCount: fallbackBrochurePages.length, sourcePdfUrl: null, isActive: true, isArchived: false, createdAt: null, updatedAt: null, isManaged: false };
}

export async function getPublicCatalogue() {
  await ensureCatalogueSeeded();
  const db = await requireDb();
  const [categoryRows, productRows] = await Promise.all([
    db.select().from(catalogueCategories).where(eq(catalogueCategories.isActive, true)).orderBy(asc(catalogueCategories.sortOrder)),
    db.select({ product: catalogueProducts, category: catalogueCategories }).from(catalogueProducts).innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id)).where(and(eq(catalogueProducts.isActive, true), eq(catalogueCategories.isActive, true))).orderBy(desc(catalogueProducts.updatedAt)),
  ]);
  return { categories: categoryRows.map(publicCategory), products: productRows.map((row) => publicProduct(row.product, row.category)) };
}

export type PublicCataloguePageInput = {
  page: number;
  pageSize: number;
  categorySlug?: string;
  path?: string[];
  query?: string;
  brand?: string;
  availability?: Array<ProductAvailability>;
  minPrice?: number;
  maxPrice?: number;
  sort?: "relevance" | "price-asc" | "price-desc" | "name-asc" | "name-desc";
};

const legacyCategoryRootsByPublicSlug: Record<string, number[]> = {
  instrumenti: [91], gradina: [93], banya: [95], "podovi-i-stenni-pokritiya": [90], "v-i-k": [97], osvetlenie: [163], "boi-lakove-mazilki": [92], "vrati-obkov-krepezhi": [199], "za-doma": [204], stroitelstvo: [178, 85], "rabotno-obleklo": [61],
};

const cyrillicToLatin: Record<string, string> = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya" };
const latinPathToken = (value: string) => Array.from(value.toLocaleLowerCase("bg-BG").normalize("NFD")).map((character) => cyrillicToLatin[character] ?? character).join("").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "category";

type LegacyCategoryTreeRow = Pick<typeof catalogueCategories.$inferSelect, "legacyCategoryId" | "legacyParentCategoryId" | "name" | "sortOrder">;
type LegacyCategoryBranchRow = Pick<typeof catalogueCategories.$inferSelect, "id" | "legacyCategoryId" | "legacyParentCategoryId">;

function legacyTreeForPublicCategory(rows: LegacyCategoryTreeRow[], roots: number[], depth = 2): Array<{ label: string; children?: Array<{ label: string; children?: Array<{ label: string }> }> }> {
  if (!roots.length) return [];
  const childrenOf = (parents: number[]) => rows.filter((row) => row.legacyParentCategoryId != null && parents.includes(row.legacyParentCategoryId)).sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "bg"));
  const build = (parents: number[], remainingDepth: number): Array<{ label: string; children?: Array<{ label: string; children?: Array<{ label: string }> }> }> => childrenOf(parents).map((row) => {
    const children = remainingDepth > 0 && row.legacyCategoryId != null ? build([row.legacyCategoryId], remainingDepth - 1) : [];
    return children.length ? { label: row.name, children } : { label: row.name };
  });
  return build(roots, depth);
}

export function descendantCategoryIds(rows: LegacyCategoryBranchRow[], selectedInternalIds: number[]) {
  const selected = new Set(selectedInternalIds);
  const childrenByParent = new Map<number, LegacyCategoryBranchRow[]>();
  const selectedLegacyIds = rows.filter((row) => selected.has(row.id)).flatMap((row) => row.legacyCategoryId == null ? [] : [row.legacyCategoryId]);
  for (const row of rows) {
    if (row.legacyParentCategoryId == null) continue;
    const children = childrenByParent.get(row.legacyParentCategoryId) ?? [];
    children.push(row);
    childrenByParent.set(row.legacyParentCategoryId, children);
  }
  const pending = [...selectedLegacyIds];
  while (pending.length) {
    const legacyParentId = pending.shift();
    if (legacyParentId == null) continue;
    for (const child of childrenByParent.get(legacyParentId) ?? []) {
      if (selected.has(child.id)) continue;
      selected.add(child.id);
      if (child.legacyCategoryId != null) pending.push(child.legacyCategoryId);
    }
  }
  return Array.from(selected);
}

async function resolveLegacyPathCategoryIds(categorySlug: string, path: string[]) {
  if (!path.length) return [];
  const roots = legacyCategoryRootsByPublicSlug[categorySlug] ?? [];
  if (!roots.length) return [];
  const db = await requireDb();
  let parentLegacyIds = roots;
  let matchedInternalIds: number[] = [];
  for (const label of path) {
    const candidates = await db.select({ id: catalogueCategories.id, legacyCategoryId: catalogueCategories.legacyCategoryId, name: catalogueCategories.name }).from(catalogueCategories).where(inArray(catalogueCategories.legacyParentCategoryId, parentLegacyIds));
    const rows = candidates.filter((row) => row.name === label || latinPathToken(row.name) === label);
    if (!rows.length) return [];
    matchedInternalIds = rows.map((row) => row.id);
    parentLegacyIds = rows.flatMap((row) => row.legacyCategoryId == null ? [] : [row.legacyCategoryId]);
  }
  const treeRows = await db.select({ id: catalogueCategories.id, legacyCategoryId: catalogueCategories.legacyCategoryId, legacyParentCategoryId: catalogueCategories.legacyParentCategoryId }).from(catalogueCategories).where(eq(catalogueCategories.isActive, true));
  return descendantCategoryIds(treeRows, matchedInternalIds);
}

function publicCatalogueConditions(input: PublicCataloguePageInput, categoryId?: number) {
  const conditions = [eq(catalogueProducts.isActive, true), eq(catalogueCategories.isActive, true)];
  if (categoryId) conditions.push(eq(catalogueProducts.categoryId, categoryId));
  if (input.brand) conditions.push(eq(catalogueProducts.brand, input.brand));
  if (input.availability?.length) conditions.push(inArray(catalogueProducts.availability, input.availability));
  if (input.minPrice != null) conditions.push(gte(catalogueProducts.priceEur, String(input.minPrice)));
  if (input.maxPrice != null) conditions.push(lte(catalogueProducts.priceEur, String(input.maxPrice)));
  if (input.query) {
    const needle = `%${input.query.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(or(like(catalogueProducts.name, needle), like(catalogueProducts.brand, needle), like(catalogueProducts.featuresJson, needle))!);
  }
  return conditions;
}

function publicCatalogueOrder(sort: PublicCataloguePageInput["sort"]) {
  const outOfStockLast = sql`CASE WHEN ${catalogueProducts.availability} = 'out_of_stock' THEN 1 ELSE 0 END`;
  if (sort === "price-asc") return [outOfStockLast, asc(catalogueProducts.priceEur), asc(catalogueProducts.name)] as const;
  if (sort === "price-desc") return [outOfStockLast, desc(catalogueProducts.priceEur), asc(catalogueProducts.name)] as const;
  if (sort === "name-asc") return [outOfStockLast, asc(catalogueProducts.name)] as const;
  if (sort === "name-desc") return [outOfStockLast, desc(catalogueProducts.name)] as const;
  return [outOfStockLast, desc(catalogueProducts.updatedAt), asc(catalogueProducts.name)] as const;
}

export async function getPublicCatalogueMetadata() {
  await ensureCatalogueSeeded();
  const db = await requireDb();
  const [categoryRows, legacyRows] = await Promise.all([
    db.select().from(catalogueCategories).where(and(eq(catalogueCategories.isActive, true), isNull(catalogueCategories.legacyCategoryId))).orderBy(asc(catalogueCategories.sortOrder)),
    db.select({ legacyCategoryId: catalogueCategories.legacyCategoryId, legacyParentCategoryId: catalogueCategories.legacyParentCategoryId, name: catalogueCategories.name, sortOrder: catalogueCategories.sortOrder }).from(catalogueCategories).where(and(eq(catalogueCategories.isActive, true), isNull(catalogueCategories.slug))),
  ]);
  return { categories: categoryRows.map((category) => ({ ...publicCategory(category), subcategories: legacyTreeForPublicCategory(legacyRows, legacyCategoryRootsByPublicSlug[category.slug] ?? []) })) };
}

export async function getPublicCataloguePage(input: PublicCataloguePageInput) {
  await ensureCatalogueSeeded();
  const db = await requireDb();
  const page = Math.max(1, input.page);
  const pageSize = Math.min(48, Math.max(1, input.pageSize));
  const category = input.categorySlug ? (await db.select().from(catalogueCategories).where(and(eq(catalogueCategories.slug, input.categorySlug), eq(catalogueCategories.isActive, true))).limit(1))[0] : undefined;
  const pathCategoryIds = category && input.path?.length ? await resolveLegacyPathCategoryIds(category.slug, input.path) : [];
  if (category && input.path?.length && !pathCategoryIds.length) return { products: [], total: 0, page, pageSize, brands: [] as string[] };
  const conditions = publicCatalogueConditions(input, category && !input.path?.length ? category.id : undefined);
  const order = publicCatalogueOrder(input.sort);
  const withPath = pathCategoryIds.length > 0;
  const selectProducts = withPath
    ? db.selectDistinct({ product: catalogueProducts, category: catalogueCategories }).from(catalogueProducts).innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id)).innerJoin(catalogueProductCategoryLinks, eq(catalogueProductCategoryLinks.productId, catalogueProducts.id)).where(and(...conditions, inArray(catalogueProductCategoryLinks.categoryId, pathCategoryIds))).orderBy(...order).limit(pageSize).offset((page - 1) * pageSize)
    : db.select({ product: catalogueProducts, category: catalogueCategories }).from(catalogueProducts).innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id)).where(and(...conditions)).orderBy(...order).limit(pageSize).offset((page - 1) * pageSize);
  const countRows = withPath
    ? await db.select({ total: countDistinct(catalogueProducts.id) }).from(catalogueProducts).innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id)).innerJoin(catalogueProductCategoryLinks, eq(catalogueProductCategoryLinks.productId, catalogueProducts.id)).where(and(...conditions, inArray(catalogueProductCategoryLinks.categoryId, pathCategoryIds)))
    : await db.select({ total: count() }).from(catalogueProducts).innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id)).where(and(...conditions));
  const [rows, brandRows] = await Promise.all([
    selectProducts,
    db.select({ brand: catalogueProducts.brand }).from(catalogueProducts).innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id)).where(and(...publicCatalogueConditions({ ...input, brand: undefined, query: undefined, minPrice: undefined, maxPrice: undefined, availability: undefined }, category && !input.path?.length ? category.id : undefined))).groupBy(catalogueProducts.brand).orderBy(asc(catalogueProducts.brand)),
  ]);
  return { products: rows.map((row) => publicProduct(row.product, row.category)), total: Number(countRows[0]?.total ?? 0), page, pageSize, brands: brandRows.flatMap((row) => row.brand ? [row.brand] : []) };
}

export async function getPublicProductBySlug(slug: string) {
  await ensureCatalogueSeeded();
  const db = await requireDb();
  const [row] = await db.select({ product: catalogueProducts, category: catalogueCategories }).from(catalogueProducts).innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id)).where(and(or(eq(catalogueProducts.slug, slug), eq(catalogueProducts.legacyPublicSlug, slug))!, eq(catalogueProducts.isActive, true), eq(catalogueCategories.isActive, true))).limit(1);
  if (!row) return null;
  const relatedRows = await db.select({ product: catalogueProducts, category: catalogueCategories }).from(catalogueProducts).innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id)).where(and(eq(catalogueProducts.categoryId, row.product.categoryId), eq(catalogueProducts.isActive, true))).orderBy(desc(catalogueProducts.updatedAt)).limit(4);
  return { product: publicProduct(row.product, row.category), related: relatedRows.filter((candidate) => candidate.product.id !== row.product.id).slice(0, 3).map((candidate) => publicProduct(candidate.product, candidate.category)) };
}

export async function getPublicProductsBySlugs(slugs: string[]) {
  if (!slugs.length) return [];
  await ensureCatalogueSeeded();
  const db = await requireDb();
  const rows = await db.select({ product: catalogueProducts, category: catalogueCategories }).from(catalogueProducts).innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id)).where(and(or(inArray(catalogueProducts.slug, slugs), inArray(catalogueProducts.legacyPublicSlug, slugs))!, eq(catalogueProducts.isActive, true), eq(catalogueCategories.isActive, true)));
  return rows.map((row) => publicProduct(row.product, row.category));
}

export async function getPublicSitemapEntries() {
  await ensureCatalogueSeeded();
  const db = await requireDb();
  const [categories, products] = await Promise.all([
    db.select({ slug: catalogueCategories.slug, updatedAt: catalogueCategories.updatedAt }).from(catalogueCategories).where(eq(catalogueCategories.isActive, true)),
    db.select({ slug: catalogueProducts.slug, updatedAt: catalogueProducts.updatedAt }).from(catalogueProducts).where(eq(catalogueProducts.isActive, true)),
  ]);
  return { categories, products };
}

export async function getAdminCategories() {
  await ensureCatalogueSeeded();
  const db = await requireDb();
  const rows = await db.select().from(catalogueCategories).orderBy(asc(catalogueCategories.sortOrder));
  return rows.map((category) => ({ ...publicCategory(category), sortOrder: category.sortOrder, isActive: category.isActive }));
}

export async function getAdminBrochures() {
  await ensureBrochureSeeded();
  const db = await requireDb();
  const rows = await db.select().from(catalogueBrochures).orderBy(desc(catalogueBrochures.updatedAt));
  return rows.map(publicBrochure);
}

export async function getAdminProducts() {
  await ensureCatalogueSeeded();
  const db = await requireDb();
  const rows = await db.select({ product: catalogueProducts, category: catalogueCategories }).from(catalogueProducts).innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id)).orderBy(desc(catalogueProducts.updatedAt));
  return rows.map((row) => ({ ...publicProduct(row.product, row.category), seoTitle: row.product.legacyMetaTitleBg ?? "", seoDescription: row.product.legacyMetaDescriptionBg ?? "", seoKeywords: row.product.legacySeoKeywordBg ?? "", seoRobots: row.product.legacyMetaRobots === "noindex,follow" ? "noindex,follow" as const : "index,follow" as const, categoryId: row.product.categoryId, categoryName: row.category.name, createdAt: row.product.createdAt, updatedAt: row.product.updatedAt }));
}

export async function getAdminOrders() {
  const db = await requireDb();
  return db.select().from(orderRequests).orderBy(desc(orderRequests.createdAt));
}

export async function getAdminContactEnquiries() {
  const db = await requireDb();
  return db.select().from(contactEnquiries).orderBy(desc(contactEnquiries.createdAt));
}

export async function getAdminSummary() {
  await ensureCatalogueSeeded();
  const db = await requireDb();
  const [[productCount], [categoryCount], [newOrderCount], [lowStockCount], recentOrders] = await Promise.all([
    db.select({ total: count() }).from(catalogueProducts).where(eq(catalogueProducts.isActive, true)),
    db.select({ total: count() }).from(catalogueCategories).where(eq(catalogueCategories.isActive, true)),
    db.select({ total: count() }).from(orderRequests).where(eq(orderRequests.status, "new")),
    db.select({ total: count() }).from(catalogueProducts).where(and(eq(catalogueProducts.isActive, true), eq(catalogueProducts.availability, "in_stock"))),
    db.select().from(orderRequests).orderBy(desc(orderRequests.createdAt)).limit(5),
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
export async function getAdminOperations() {
  await ensureCatalogueSeeded();
  const db = await requireDb();
  const [products, orders, activityRows] = await Promise.all([
    getAdminProducts(),
    getAdminOrders(),
    db.select({ activity: adminActivities, adminName: users.name, adminEmail: users.email }).from(adminActivities).innerJoin(users, eq(adminActivities.adminUserId, users.id)).orderBy(desc(adminActivities.createdAt)).limit(24),
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
    promotions: promotions.slice(0, 24),
    inventoryQueue,
    qualityQueue,
    orderCounts,
    reporting: buildAdminReportingSnapshot(orders),
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

async function assertAdminProductSlugAvailable(slug: string, excludingProductId?: number) {
  const db = await requireDb();
  const scope = excludingProductId
    ? and(or(eq(catalogueProducts.slug, slug), eq(catalogueProducts.legacyPublicSlug, slug)), ne(catalogueProducts.id, excludingProductId))
    : or(eq(catalogueProducts.slug, slug), eq(catalogueProducts.legacyPublicSlug, slug));
  const [conflict] = await db.select({ id: catalogueProducts.id }).from(catalogueProducts).where(scope!).limit(1);
  if (conflict) throw new Error("Този URL адрес вече е зает от друг продукт или е запазен за стар адрес.");
}

export async function createAdminProduct(payload: ProductPayload, adminUserId: number) {
  await assertAdminProductSlugAvailable(payload.slug);
  const db = await requireDb();
  const result = await db.insert(catalogueProducts).values({
    categoryId: payload.categoryId, slug: payload.slug, sku: payload.sku ?? null, brand: payload.brand ?? null, name: payload.name, description: payload.description, imageUrl: payload.imageUrl, galleryJson: JSON.stringify(payload.gallery), imageAlt: payload.imageAlt, priceEur: asDecimal(payload.priceEur), oldPriceEur: asDecimal(payload.oldPriceEur), discountLabel: payload.discountLabel ?? null, availability: payload.availability, stockQuantity: payload.stockQuantity, featuresJson: JSON.stringify(payload.features), legacySeoKeywordBg: payload.seoKeywords ?? null, legacyMetaTitleBg: payload.seoTitle ?? null, legacyMetaDescriptionBg: payload.seoDescription ?? null, legacyMetaRobots: payload.seoRobots ?? "index,follow", isActive: payload.isActive,
  });
  const id = Number(result[0].insertId);
  await logAdminActivity(adminUserId, "product.created", "product", id, { slug: payload.slug, name: payload.name });
  return id;
}

export async function updateAdminProduct(id: number, payload: ProductPayload, adminUserId: number) {
  const db = await requireDb();
  const [existing] = await db.select({ id: catalogueProducts.id, slug: catalogueProducts.slug }).from(catalogueProducts).where(eq(catalogueProducts.id, id)).limit(1);
  if (!existing) throw new Error("Продуктът не е намерен.");
  if (existing.slug !== payload.slug) throw new Error("URL адресът на публикуван продукт не се променя, за да се запазят SEO адресите и външните връзки.");
  await assertAdminProductSlugAvailable(payload.slug, id);
  await db.update(catalogueProducts).set({
    categoryId: payload.categoryId, slug: payload.slug, sku: payload.sku ?? null, brand: payload.brand ?? null, name: payload.name, description: payload.description, imageUrl: payload.imageUrl, galleryJson: JSON.stringify(payload.gallery), imageAlt: payload.imageAlt, priceEur: asDecimal(payload.priceEur), oldPriceEur: asDecimal(payload.oldPriceEur), discountLabel: payload.discountLabel ?? null, availability: payload.availability, stockQuantity: payload.stockQuantity, featuresJson: JSON.stringify(payload.features), legacySeoKeywordBg: payload.seoKeywords ?? null, legacyMetaTitleBg: payload.seoTitle ?? null, legacyMetaDescriptionBg: payload.seoDescription ?? null, legacyMetaRobots: payload.seoRobots ?? "index,follow", isActive: payload.isActive,
  }).where(eq(catalogueProducts.id, id));
  await logAdminActivity(adminUserId, "product.updated", "product", id, { slug: payload.slug, name: payload.name });
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

export async function saveProductPromotion(input: { id: number; priceEur: number | null; oldPriceEur: number | null; discountLabel: string | null }, adminUserId: number) {
  const db = await requireDb();
  const [product] = await db.select().from(catalogueProducts).where(eq(catalogueProducts.id, input.id)).limit(1);
  if (!product) throw new Error("Product was not found");
  await db.update(catalogueProducts).set({ priceEur: asDecimal(input.priceEur), oldPriceEur: asDecimal(input.oldPriceEur), discountLabel: input.discountLabel?.trim() || null }).where(eq(catalogueProducts.id, input.id));
  await logAdminActivity(adminUserId, "promotion.updated", "product", input.id, { slug: product.slug, name: product.name, discountLabel: input.discountLabel ?? null });
}

export async function saveAdminCategory(id: number | undefined, payload: CategoryPayload, adminUserId: number) {
  const db = await requireDb();
  const values = { slug: payload.slug, name: payload.name, description: payload.description, imageUrl: payload.imageUrl, icon: payload.icon, subcategoriesJson: JSON.stringify(payload.subcategories), sortOrder: payload.sortOrder, isActive: payload.isActive };
  if (id) {
    await db.update(catalogueCategories).set(values).where(eq(catalogueCategories.id, id));
    await logAdminActivity(adminUserId, "category.updated", "category", id, { slug: payload.slug, name: payload.name });
    return id;
  }
  const result = await db.insert(catalogueCategories).values(values);
  const categoryId = Number(result[0].insertId);
  await logAdminActivity(adminUserId, "category.created", "category", categoryId, { slug: payload.slug, name: payload.name });
  return categoryId;
}

export async function updateOrderRequest(id: number, status: OrderRequestStatus, adminNote: string | null, adminUserId: number) {
  const db = await requireDb();
  await db.update(orderRequests).set({ status, adminNote }).where(eq(orderRequests.id, id));
  await logAdminActivity(adminUserId, "order.updated", "order_request", id, { status });
}

export async function updateContactEnquiry(id: number, status: ContactEnquiryStatus, adminNote: string | null, adminUserId: number) {
  const db = await requireDb();
  await db.update(contactEnquiries).set({ status, adminNote }).where(eq(contactEnquiries.id, id));
  await logAdminActivity(adminUserId, "contact_enquiry.updated", "contact_enquiry", id, { status });
}

export async function createOrderRequest(input: { productSlug: string; quantity: number; fullName: string; email: string; phone: string; address: string; city: string; postcode: string }) {
  await ensureCatalogueSeeded();
  const db = await requireDb();
  const [product] = await db.select().from(catalogueProducts).where(and(eq(catalogueProducts.slug, input.productSlug), eq(catalogueProducts.isActive, true), ne(catalogueProducts.availability, "out_of_stock"))).limit(1);
  if (!product) throw new Error("Product is unavailable");
  const price = product.priceEur ? Number(product.priceEur) : null;
  const total = price === null ? null : price * input.quantity;
  const requestNumber = `J-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 5).toUpperCase()}`;
  await db.insert(orderRequests).values({
    requestNumber, productId: product.id, productName: product.name, productSku: product.sku, productImageUrl: product.imageUrl, quantity: input.quantity, priceEur: asDecimal(price), totalEur: asDecimal(total), fullName: input.fullName, email: input.email, phone: input.phone, address: input.address, city: input.city, postcode: input.postcode, status: "new", adminNote: null,
  });
  return { requestNumber };
}

export async function createContactEnquiry(input: { fullName: string; email: string; phone?: string | null; subject: string; message: string }) {
  const db = await requireDb();
  const referenceNumber = `C-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 5).toUpperCase()}`;
  await db.insert(contactEnquiries).values({ referenceNumber, fullName: input.fullName, email: input.email, phone: input.phone?.trim() || null, subject: input.subject, message: input.message, status: "new", adminNote: null });
  return { referenceNumber };
}

export async function uploadProductImage(input: { dataUrl: string; fileName: string }, adminUserId: number) {
  const match = input.dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Only JPEG, PNG, and WEBP image uploads are supported");
  const contentType = match[1];
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > 4 * 1024 * 1024) throw new Error("Image files must be between 1 byte and 4 MB");
  const extension = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1];
  const safeName = input.fileName.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 80) || "product";
  const stored = await storagePut(`catalogue/admin/${safeName}.${extension}`, bytes, contentType);
  await logAdminActivity(adminUserId, "product_image.uploaded", "product_image", null, { key: stored.key });
  return stored;
}

function decodeDataUrl(dataUrl: string, expression: RegExp, message: string) {
  const match = dataUrl.match(expression);
  if (!match) throw new Error(message);
  return Buffer.from(match[1], "base64");
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
    if (pdfBytes.subarray(0, 4).toString("ascii") !== "%PDF") throw new Error("The uploaded file is not a valid PDF brochure");
    const safePdfName = safeBrochureName(input.sourcePdf.fileName.replace(/\.pdf$/i, ""), "brochure");
    sourcePdf = await storagePut(`brochures/${reference}/${safePdfName}.pdf`, pdfBytes, "application/pdf");
  }
  const pageUrls: string[] = [];
  for (let index = 0; index < input.pages.length; index += 1) {
    const page = input.pages[index];
    const pageBytes = decodeDataUrl(page.dataUrl, /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/, "Brochure pages must be JPEG images");
    if (pageBytes.length === 0 || pageBytes.length > 3 * 1024 * 1024) throw new Error("Each brochure page must be between 1 byte and 3 MB");
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

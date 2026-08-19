import { and, asc, count, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { categories as seedCategories, products as seedProducts } from "../client/src/lib/storeData";
import { adminActivities, catalogueCategories, catalogueProducts, orderRequests } from "../drizzle/schema";
import { getDb } from "./db";
import { storagePut } from "./storage";

export type ProductAvailability = "in_stock" | "on_request" | "out_of_stock";
export type OrderRequestStatus = "new" | "contacted" | "confirmed" | "closed" | "cancelled";

export type ProductPayload = {
  categoryId: number;
  slug: string;
  sku?: string | null;
  brand?: string | null;
  name: string;
  description: string;
  imageUrl: string;
  gallery: string[];
  imageAlt: string;
  priceEur?: number | null;
  priceBgn?: number | null;
  oldPriceEur?: number | null;
  oldPriceBgn?: number | null;
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
  subcategories: string[];
  sortOrder: number;
  isActive: boolean;
};

const availabilityLabels: Record<ProductAvailability, string> = {
  in_stock: "На склад",
  on_request: "По запитване",
  out_of_stock: "Изчерпан",
};

function parseJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function formatPrice(value: string | null) {
  return value === null ? undefined : `${Number(value).toFixed(2)}€`;
}

function formatBgn(value: string | null) {
  return value === null ? undefined : `${Number(value).toFixed(2)} лв`;
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

/** Imports the existing public catalogue once, keeping current routes stable while admin management takes over. */
export function ensureCatalogueSeeded() {
  if (!seeded) seeded = seedCatalogue();
  return seeded;
}

async function seedCatalogue() {
  const db = await requireDb();
  const [existing] = await db.select({ total: count() }).from(catalogueCategories);
  if ((existing?.total ?? 0) > 0) return;

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
    const priceBgn = product.priceBgn ? Number(product.priceBgn.replace(/[^[0-9.,]/g, "").replace(",", ".")) : null;
    const oldPriceBgn = product.oldPriceBgn ? Number(product.oldPriceBgn.replace(/[^[0-9.,]/g, "").replace(",", ".")) : null;
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
      priceBgn: asDecimal(priceBgn),
      oldPriceEur: asDecimal(oldPriceEur),
      oldPriceBgn: asDecimal(oldPriceBgn),
      discountLabel: product.discount ?? null,
      availability: product.availability === "На склад" ? "in_stock" : "on_request",
      stockQuantity: product.availability === "На склад" ? 1 : 0,
      featuresJson: JSON.stringify(product.features),
      isActive: true,
    });
  }
}

function publicCategory(category: typeof catalogueCategories.$inferSelect) {
  return {
    id: category.id,
    slug: category.slug,
    label: category.name,
    description: category.description,
    image: category.imageUrl,
    icon: category.icon,
    subcategories: parseJsonArray(category.subcategoriesJson),
  };
}

function publicProduct(product: typeof catalogueProducts.$inferSelect, category: typeof catalogueCategories.$inferSelect) {
  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku ?? undefined,
    brand: product.brand ?? undefined,
    name: product.name,
    image: product.imageUrl,
    gallery: parseJsonArray(product.galleryJson),
    imageAlt: product.imageAlt,
    price: formatPrice(product.priceEur),
    priceBgn: formatBgn(product.priceBgn),
    oldPrice: formatPrice(product.oldPriceEur),
    oldPriceBgn: formatBgn(product.oldPriceBgn),
    discount: product.discountLabel ?? undefined,
    category: category.slug,
    availability: availabilityLabels[product.availability],
    availabilityCode: product.availability,
    stockQuantity: product.stockQuantity,
    features: parseJsonArray(product.featuresJson),
    description: product.description,
    isActive: product.isActive,
  };
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

export async function getAdminCategories() {
  await ensureCatalogueSeeded();
  const db = await requireDb();
  const rows = await db.select().from(catalogueCategories).orderBy(asc(catalogueCategories.sortOrder));
  return rows.map((category) => ({ ...publicCategory(category), sortOrder: category.sortOrder, isActive: category.isActive }));
}

export async function getAdminProducts() {
  await ensureCatalogueSeeded();
  const db = await requireDb();
  const rows = await db.select({ product: catalogueProducts, category: catalogueCategories }).from(catalogueProducts).innerJoin(catalogueCategories, eq(catalogueProducts.categoryId, catalogueCategories.id)).orderBy(desc(catalogueProducts.updatedAt));
  return rows.map((row) => ({ ...publicProduct(row.product, row.category), categoryId: row.product.categoryId, categoryName: row.category.name, createdAt: row.product.createdAt, updatedAt: row.product.updatedAt }));
}

export async function getAdminOrders() {
  const db = await requireDb();
  return db.select().from(orderRequests).orderBy(desc(orderRequests.createdAt));
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

export async function logAdminActivity(adminUserId: number, action: string, entityType: string, entityId?: number | null, metadata: Record<string, unknown> = {}) {
  const db = await requireDb();
  await db.insert(adminActivities).values({ adminUserId, action, entityType, entityId: entityId ?? null, metadataJson: JSON.stringify(metadata) });
}

export async function createAdminProduct(payload: ProductPayload, adminUserId: number) {
  const db = await requireDb();
  const result = await db.insert(catalogueProducts).values({
    categoryId: payload.categoryId, slug: payload.slug, sku: payload.sku ?? null, brand: payload.brand ?? null, name: payload.name, description: payload.description, imageUrl: payload.imageUrl, galleryJson: JSON.stringify(payload.gallery), imageAlt: payload.imageAlt, priceEur: asDecimal(payload.priceEur), priceBgn: asDecimal(payload.priceBgn), oldPriceEur: asDecimal(payload.oldPriceEur), oldPriceBgn: asDecimal(payload.oldPriceBgn), discountLabel: payload.discountLabel ?? null, availability: payload.availability, stockQuantity: payload.stockQuantity, featuresJson: JSON.stringify(payload.features), isActive: payload.isActive,
  });
  const id = Number(result[0].insertId);
  await logAdminActivity(adminUserId, "product.created", "product", id, { slug: payload.slug, name: payload.name });
  return id;
}

export async function updateAdminProduct(id: number, payload: ProductPayload, adminUserId: number) {
  const db = await requireDb();
  await db.update(catalogueProducts).set({
    categoryId: payload.categoryId, slug: payload.slug, sku: payload.sku ?? null, brand: payload.brand ?? null, name: payload.name, description: payload.description, imageUrl: payload.imageUrl, galleryJson: JSON.stringify(payload.gallery), imageAlt: payload.imageAlt, priceEur: asDecimal(payload.priceEur), priceBgn: asDecimal(payload.priceBgn), oldPriceEur: asDecimal(payload.oldPriceEur), oldPriceBgn: asDecimal(payload.oldPriceBgn), discountLabel: payload.discountLabel ?? null, availability: payload.availability, stockQuantity: payload.stockQuantity, featuresJson: JSON.stringify(payload.features), isActive: payload.isActive,
  }).where(eq(catalogueProducts.id, id));
  await logAdminActivity(adminUserId, "product.updated", "product", id, { slug: payload.slug, name: payload.name });
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

export async function createOrderRequest(input: { productSlug: string; quantity: number; fullName: string; email: string; phone: string; address: string; city: string; postcode: string }) {
  await ensureCatalogueSeeded();
  const db = await requireDb();
  const [product] = await db.select().from(catalogueProducts).where(and(eq(catalogueProducts.slug, input.productSlug), eq(catalogueProducts.isActive, true))).limit(1);
  if (!product) throw new Error("Product is unavailable");
  const price = product.priceEur ? Number(product.priceEur) : null;
  const total = price === null ? null : price * input.quantity;
  const requestNumber = `J-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 5).toUpperCase()}`;
  await db.insert(orderRequests).values({
    requestNumber, productId: product.id, productName: product.name, productSku: product.sku, productImageUrl: product.imageUrl, quantity: input.quantity, priceEur: asDecimal(price), totalEur: asDecimal(total), fullName: input.fullName, email: input.email, phone: input.phone, address: input.address, city: input.city, postcode: input.postcode, status: "new", adminNote: null,
  });
  return { requestNumber };
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

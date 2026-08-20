import { boolean, decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/** Manus-authenticated users. The project owner becomes an admin during authentication. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/** Catalogue taxonomies are managed independently from products. */
export const catalogueCategories = mysqlTable("catalogue_categories", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  imageUrl: text("imageUrl").notNull(),
  icon: varchar("icon", { length: 64 }).notNull(),
  subcategoriesJson: text("subcategoriesJson").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Public product records, with media URLs held in storage and metadata held in the database. */
export const catalogueProducts = mysqlTable("catalogue_products", {
  id: int("id").autoincrement().primaryKey(),
  categoryId: int("categoryId").notNull().references(() => catalogueCategories.id),
  slug: varchar("slug", { length: 160 }).notNull().unique(),
  sku: varchar("sku", { length: 96 }),
  brand: varchar("brand", { length: 160 }),
  name: varchar("name", { length: 500 }).notNull(),
  description: text("description").notNull(),
  imageUrl: text("imageUrl").notNull(),
  galleryJson: text("galleryJson").notNull(),
  imageAlt: text("imageAlt").notNull(),
  priceEur: decimal("priceEur", { precision: 10, scale: 2 }),
  priceBgn: decimal("priceBgn", { precision: 10, scale: 2 }),
  oldPriceEur: decimal("oldPriceEur", { precision: 10, scale: 2 }),
  oldPriceBgn: decimal("oldPriceBgn", { precision: 10, scale: 2 }),
  discountLabel: varchar("discountLabel", { length: 48 }),
  availability: mysqlEnum("availability", ["in_stock", "on_request", "out_of_stock"]).default("on_request").notNull(),
  stockQuantity: int("stockQuantity").default(0).notNull(),
  featuresJson: text("featuresJson").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("products_category_active_idx").on(table.categoryId, table.isActive)]);

/** Non-payment order requests created by the public checkout flow. */
export const orderRequests = mysqlTable("order_requests", {
  id: int("id").autoincrement().primaryKey(),
  requestNumber: varchar("requestNumber", { length: 32 }).notNull().unique(),
  productId: int("productId").references(() => catalogueProducts.id),
  productName: varchar("productName", { length: 500 }).notNull(),
  productSku: varchar("productSku", { length: 96 }),
  productImageUrl: text("productImageUrl").notNull(),
  quantity: int("quantity").notNull(),
  priceEur: decimal("priceEur", { precision: 10, scale: 2 }),
  totalEur: decimal("totalEur", { precision: 10, scale: 2 }),
  fullName: varchar("fullName", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 64 }).notNull(),
  address: text("address").notNull(),
  city: varchar("city", { length: 160 }).notNull(),
  postcode: varchar("postcode", { length: 20 }).notNull(),
  status: mysqlEnum("status", ["new", "contacted", "confirmed", "closed", "cancelled"]).default("new").notNull(),
  adminNote: text("adminNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("order_requests_status_created_idx").on(table.status, table.createdAt)]);

/** Direct public contact enquiries submitted from the storefront contact form. */
export const contactEnquiries = mysqlTable("contact_enquiries", {
  id: int("id").autoincrement().primaryKey(),
  referenceNumber: varchar("referenceNumber", { length: 32 }).notNull().unique(),
  fullName: varchar("fullName", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 64 }),
  subject: varchar("subject", { length: 160 }).notNull(),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["new", "contacted", "closed"]).default("new").notNull(),
  adminNote: text("adminNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("contact_enquiries_status_created_idx").on(table.status, table.createdAt)]);

/** Versioned brochure records reference source PDFs and pre-rendered page images held in storage. */
export const catalogueBrochures = mysqlTable("catalogue_brochures", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  sourcePdfKey: text("sourcePdfKey"),
  sourcePdfUrl: text("sourcePdfUrl"),
  pageUrlsJson: text("pageUrlsJson").notNull(),
  pageCount: int("pageCount").notNull(),
  isActive: boolean("isActive").default(false).notNull(),
  isArchived: boolean("isArchived").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("brochures_active_archived_idx").on(table.isActive, table.isArchived)]);

/** Compact audit log for substantive management activity. */
export const adminActivities = mysqlTable("admin_activities", {
  id: int("id").autoincrement().primaryKey(),
  adminUserId: int("adminUserId").notNull().references(() => users.id),
  action: varchar("action", { length: 96 }).notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: int("entityId"),
  metadataJson: text("metadataJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("admin_activities_created_idx").on(table.createdAt)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type CatalogueCategory = typeof catalogueCategories.$inferSelect;
export type CatalogueProduct = typeof catalogueProducts.$inferSelect;
export type OrderRequest = typeof orderRequests.$inferSelect;
export type ContactEnquiry = typeof contactEnquiries.$inferSelect;
export type CatalogueBrochure = typeof catalogueBrochures.$inferSelect;

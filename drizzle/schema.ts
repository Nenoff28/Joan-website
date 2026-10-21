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

/** Portable website permissions; the legacy Manus administrator remains a bootstrap identity. */
export const accessRoles = mysqlTable("access_roles", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  permissionsJson: text("permissionsJson").notNull(),
  isSystem: boolean("isSystem").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Storefront customer profiles are kept separate from Manus OAuth administrator identities. */
export const customerProfiles = mysqlTable("customer_profiles", {
  id: int("id").autoincrement().primaryKey(),
  legacyCustomerId: int("legacyCustomerId").unique(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  firstName: varchar("firstName", { length: 160 }).notNull(),
  lastName: varchar("lastName", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 64 }),
  accessRoleId: int("accessRoleId").references(() => accessRoles.id),
  staffUserId: int("staffUserId").unique().references(() => users.id),
  emailVerifiedAt: timestamp("emailVerifiedAt"),
  newsletterSubscribed: boolean("newsletterSubscribed").default(false).notNull(),
  legacyWasApproved: boolean("legacyWasApproved").default(false).notNull(),
  legacyWasActive: boolean("legacyWasActive").default(false).notNull(),
  accountStatus: mysqlEnum("accountStatus", ["pending_activation", "active", "disabled"]).default("pending_activation").notNull(),
  importedAt: timestamp("importedAt").defaultNow().notNull(),
  activatedAt: timestamp("activatedAt"),
  lastSignedInAt: timestamp("lastSignedInAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("customer_profiles_status_idx").on(table.accountStatus)]);

/** Google subjects, not matching email strings, identify the external account. */
export const customerGoogleIdentities = mysqlTable("customer_google_identities", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull().unique().references(() => customerProfiles.id),
  subject: varchar("subject", { length: 255 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Imported addresses remain associated with the stored customer profile. */
export const customerAddresses = mysqlTable("customer_addresses", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull().references(() => customerProfiles.id),
  legacyPosition: int("legacyPosition").notNull(),
  firstName: varchar("firstName", { length: 160 }).notNull(),
  lastName: varchar("lastName", { length: 160 }).notNull(),
  company: varchar("company", { length: 255 }),
  addressLine1: varchar("addressLine1", { length: 512 }).notNull(),
  addressLine2: varchar("addressLine2", { length: 512 }),
  city: varchar("city", { length: 160 }).notNull(),
  postcode: varchar("postcode", { length: 32 }),
  zone: varchar("zone", { length: 160 }),
  country: varchar("country", { length: 160 }),
  isDefault: boolean("isDefault").default(false).notNull(),
  importedAt: timestamp("importedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("customer_addresses_customer_idx").on(table.customerId)]);

/** New password credentials intentionally exclude legacy OpenCart password and salt values. */
export const customerCredentials = mysqlTable("customer_credentials", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull().unique().references(() => customerProfiles.id),
  passwordHash: varchar("passwordHash", { length: 255 }),
  passwordSetAt: timestamp("passwordSetAt"),
  sessionVersion: int("sessionVersion").default(1).notNull(),
  failedLoginCount: int("failedLoginCount").default(0).notNull(),
  lockedUntil: timestamp("lockedUntil"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Single-use hashed activation and password-reset tokens; plaintext tokens are never stored. */
export const customerActivationTokens = mysqlTable("customer_activation_tokens", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull().references(() => customerProfiles.id),
  purpose: mysqlEnum("purpose", ["activation", "password_reset"]).notNull(),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("customer_activation_tokens_lookup_idx").on(table.customerId, table.purpose, table.expiresAt)]);

/** Historical OpenCart order headers exclude payment instrument data, addresses, IPs, and browser metadata. */
export const legacyCustomerOrders = mysqlTable("legacy_customer_orders", {
  id: int("id").autoincrement().primaryKey(),
  legacyOrderId: int("legacyOrderId").notNull().unique(),
  customerId: int("customerId").references(() => customerProfiles.id),
  legacyCustomerId: int("legacyCustomerId"),
  storeName: varchar("storeName", { length: 255 }),
  orderStatus: varchar("orderStatus", { length: 160 }).notNull(),
  currencyCode: varchar("currencyCode", { length: 8 }).notNull(),
  currencyValue: decimal("currencyValue", { precision: 16, scale: 8 }).notNull(),
  total: decimal("total", { precision: 14, scale: 2 }).notNull(),
  totalInOrderCurrency: decimal("totalInOrderCurrency", { precision: 14, scale: 2 }),
  orderedAt: timestamp("orderedAt").notNull(),
  legacyModifiedAt: timestamp("legacyModifiedAt"),
  importedAt: timestamp("importedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("legacy_customer_orders_customer_date_idx").on(table.customerId, table.orderedAt), index("legacy_customer_orders_status_idx").on(table.orderStatus)]);

/** Product lines from historical orders remain immutable migration records and do not imply present-day catalogue availability. */
export const legacyCustomerOrderLines = mysqlTable("legacy_customer_order_lines", {
  id: int("id").autoincrement().primaryKey(),
  legacyOrderRecordId: int("legacyOrderRecordId").notNull().references(() => legacyCustomerOrders.id),
  legacyProductId: int("legacyProductId"),
  linePosition: int("linePosition").notNull(),
  productName: varchar("productName", { length: 500 }).notNull(),
  productModel: varchar("productModel", { length: 160 }),
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unitPrice", { precision: 14, scale: 2 }).notNull(),
  lineTotal: decimal("lineTotal", { precision: 14, scale: 2 }).notNull(),
  lineTax: decimal("lineTax", { precision: 14, scale: 2 }),
  importedAt: timestamp("importedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("legacy_customer_order_lines_order_idx").on(table.legacyOrderRecordId)]);

/** Catalogue taxonomies are managed independently from products. */
export const catalogueCategories = mysqlTable("catalogue_categories", {
  id: int("id").autoincrement().primaryKey(),
  legacyCategoryId: int("legacyCategoryId").unique(),
  legacyParentCategoryId: int("legacyParentCategoryId"),
  parentId: int("parentId").references((): any => catalogueCategories.id),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  imageUrl: text("imageUrl").notNull(),
  icon: varchar("icon", { length: 64 }).notNull(),
  subcategoriesJson: text("subcategoriesJson").notNull(),
  legacySeoKeywordBg: varchar("legacySeoKeywordBg", { length: 255 }),
  legacySeoKeywordEn: varchar("legacySeoKeywordEn", { length: 255 }),
  legacyMetaTitleBg: varchar("legacyMetaTitleBg", { length: 500 }),
  legacyMetaTitleEn: varchar("legacyMetaTitleEn", { length: 500 }),
  legacyMetaDescriptionBg: text("legacyMetaDescriptionBg"),
  legacyMetaDescriptionEn: text("legacyMetaDescriptionEn"),
  legacyCanonicalUrl: text("legacyCanonicalUrl"),
  legacyMetaRobots: varchar("legacyMetaRobots", { length: 255 }),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  isArchived: boolean("isArchived").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Public product records, with media URLs held in storage and metadata held in the database. */
export const catalogueProducts = mysqlTable("catalogue_products", {
  id: int("id").autoincrement().primaryKey(),
  legacyProductId: int("legacyProductId").unique(),
  legacyManufacturerId: int("legacyManufacturerId"),
  categoryId: int("categoryId").notNull().references(() => catalogueCategories.id),
  slug: varchar("slug", { length: 160 }).notNull().unique(),
  legacyPublicSlug: varchar("legacyPublicSlug", { length: 160 }).unique(),
  sku: varchar("sku", { length: 96 }),
  brand: varchar("brand", { length: 160 }),
  name: varchar("name", { length: 500 }).notNull(),
  description: text("description").notNull(),
  imageUrl: text("imageUrl").notNull(),
  galleryJson: text("galleryJson").notNull(),
  imageAlt: text("imageAlt").notNull(),
  priceEur: decimal("priceEur", { precision: 10, scale: 2 }),
  oldPriceEur: decimal("oldPriceEur", { precision: 10, scale: 2 }),
  discountLabel: varchar("discountLabel", { length: 48 }),
  colorName: varchar("colorName", { length: 120 }),
  colorRgb: varchar("colorRgb", { length: 7 }),
  availability: mysqlEnum("availability", ["in_stock", "on_request", "out_of_stock"]).default("on_request").notNull(),
  stockQuantity: int("stockQuantity").default(0).notNull(),
  featuresJson: text("featuresJson").notNull(),
  legacySeoKeywordBg: varchar("legacySeoKeywordBg", { length: 255 }),
  legacySeoKeywordEn: varchar("legacySeoKeywordEn", { length: 255 }),
  legacyMetaTitleBg: varchar("legacyMetaTitleBg", { length: 500 }),
  legacyMetaTitleEn: varchar("legacyMetaTitleEn", { length: 500 }),
  legacyMetaDescriptionBg: text("legacyMetaDescriptionBg"),
  legacyMetaDescriptionEn: text("legacyMetaDescriptionEn"),
  legacyCanonicalUrl: text("legacyCanonicalUrl"),
  legacyMetaRobots: varchar("legacyMetaRobots", { length: 255 }),
  isActive: boolean("isActive").default(true).notNull(),
  isArchived: boolean("isArchived").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("products_category_active_idx").on(table.categoryId, table.isActive), index("products_active_updated_idx").on(table.isActive, table.updatedAt)]);

/** AI-generated product content is isolated from the published catalogue fields until an administrator approves it. */
export const catalogueProductAiContent = mysqlTable("catalogue_product_ai_content", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull().unique().references(() => catalogueProducts.id),
  aiProvider: varchar("aiProvider", { length: 32 }),
  aiModel: varchar("aiModel", { length: 160 }),
  aiStatus: mysqlEnum("aiStatus", ["pending", "generated", "reviewed", "published", "error"]).default("pending").notNull(),
  aiDescription: text("aiDescription"),
  aiFeatures: text("aiFeatures"),
  aiSeoTitle: varchar("aiSeoTitle", { length: 500 }),
  aiSeoDescription: text("aiSeoDescription"),
  aiKeywords: varchar("aiKeywords", { length: 1000 }),
  aiSourceUrls: text("aiSourceUrls"),
  aiConfidence: mysqlEnum("aiConfidence", ["high", "low"]),
  aiError: text("aiError"),
  aiGeneratedAt: timestamp("aiGeneratedAt"),
  aiInputTokens: int("aiInputTokens"),
  aiOutputTokens: int("aiOutputTokens"),
  aiSearchCount: int("aiSearchCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("product_ai_status_idx").on(table.aiStatus)]);

/** One reversible snapshot per product, kept until the administrator restores the old content. */
export const catalogueProductAiBackups = mysqlTable("catalogue_product_ai_backups", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull().unique().references(() => catalogueProducts.id),
  description: text("description").notNull(),
  featuresJson: text("featuresJson").notNull(),
  seoTitle: varchar("seoTitle", { length: 500 }),
  seoDescription: text("seoDescription"),
  keywords: varchar("keywords", { length: 255 }),
  backedUpAt: timestamp("backedUpAt").defaultNow().notNull(),
  restoredAt: timestamp("restoredAt"),
}, (table) => [index("product_ai_backup_product_idx").on(table.productId)]);

/** Administrator-editable system prompt used for AI product-content generation. */
export const aiContentSettings = mysqlTable("ai_content_settings", {
  id: int("id").primaryKey(),
  systemPrompt: text("systemPrompt").notNull(),
  model: varchar("model", { length: 160 }).default("gemini-3.8-flash").notNull(),
  dailyGenerationLimit: int("dailyGenerationLimit").default(20).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Persistent background batches allow AI generation to continue after the admin browser closes. */
export const aiGenerationBatches = mysqlTable("ai_generation_batches", {
  id: int("id").autoincrement().primaryKey(),
  status: mysqlEnum("status", ["queued", "running", "paused", "completed", "failed"]).default("queued").notNull(),
  totalJobs: int("totalJobs").default(0).notNull(),
  createdBy: int("createdBy").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  startedAt: timestamp("startedAt"),
  finishedAt: timestamp("finishedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("ai_generation_batches_status_idx").on(table.status)]);

/** One durable job per product and batch; workers claim at most five jobs concurrently. */
export const aiGenerationJobs = mysqlTable("ai_generation_jobs", {
  id: int("id").autoincrement().primaryKey(),
  batchId: int("batchId").notNull().references(() => aiGenerationBatches.id),
  productId: int("productId").notNull().references(() => catalogueProducts.id),
  status: mysqlEnum("status", ["queued", "running", "succeeded", "failed"]).default("queued").notNull(),
  attempts: int("attempts").default(0).notNull(),
  maxAttempts: int("maxAttempts").default(3).notNull(),
  lastError: text("lastError"),
  nextAttemptAt: timestamp("nextAttemptAt"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("ai_generation_jobs_batch_idx").on(table.batchId, table.status), index("ai_generation_jobs_retry_idx").on(table.status, table.nextAttemptAt)]);

/** UTC day counters enforce the administrator-configured generation limit atomically per worker process. */
export const aiGenerationDailyUsage = mysqlTable("ai_generation_daily_usage", {
  usageDate: varchar("usageDate", { length: 10 }).primaryKey(),
  generatedCount: int("generatedCount").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** English customer-facing content is stored separately so imported Bulgarian source data remains immutable. */
export const catalogueProductEnglish = mysqlTable("catalogue_product_english", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull().unique().references(() => catalogueProducts.id),
  brand: varchar("brand", { length: 160 }),
  name: varchar("name", { length: 500 }).notNull(),
  description: text("description").notNull(),
  imageAlt: text("imageAlt").notNull(),
  featuresJson: text("featuresJson").notNull(),
  seoKeywords: varchar("seoKeywords", { length: 255 }),
  seoTitle: varchar("seoTitle", { length: 500 }),
  seoDescription: text("seoDescription"),
  sourceContentHash: varchar("sourceContentHash", { length: 64 }).notNull(),
  translatedAt: timestamp("translatedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** English root-category labels, descriptions and nested navigation trees remain independent from Bulgarian import data. */
export const catalogueCategoryEnglish = mysqlTable("catalogue_category_english", {
  id: int("id").autoincrement().primaryKey(),
  categoryId: int("categoryId").notNull().unique().references(() => catalogueCategories.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  subcategoriesJson: text("subcategoriesJson").notNull(),
  seoKeywords: varchar("seoKeywords", { length: 255 }),
  seoTitle: varchar("seoTitle", { length: 500 }),
  seoDescription: text("seoDescription"),
  sourceContentHash: varchar("sourceContentHash", { length: 64 }).notNull(),
  translatedAt: timestamp("translatedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Imported OpenCart manufacturer records retain their original identity and public metadata. */
export const catalogueManufacturers = mysqlTable("catalogue_manufacturers", {
  id: int("id").autoincrement().primaryKey(),
  legacyManufacturerId: int("legacyManufacturerId").notNull().unique(),
  slug: varchar("slug", { length: 160 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  nameEn: varchar("nameEn", { length: 255 }),
  description: text("description"),
  imageUrl: text("imageUrl"),
  officialLogoUrl: text("officialLogoUrl"),
  officialLogoSourceUrl: text("officialLogoSourceUrl"),
  officialLogoVerifiedAt: timestamp("officialLogoVerifiedAt"),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  importedAt: timestamp("importedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Preserve legacy category membership beyond the primary category used by current storefront cards. */
export const catalogueProductCategoryLinks = mysqlTable("catalogue_product_category_links", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull().references(() => catalogueProducts.id),
  categoryId: int("categoryId").notNull().references(() => catalogueCategories.id),
  position: int("position").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("catalogue_product_category_links_product_idx").on(table.productId), index("catalogue_product_category_links_category_idx").on(table.categoryId)]);

/** Scheduled percentage campaigns; product base prices remain unchanged. */
export const promotionCampaigns = mysqlTable("promotion_campaigns", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  discountPercent: decimal("discountPercent", { precision: 5, scale: 2 }),
  fixedPriceEur: decimal("fixedPriceEur", { precision: 10, scale: 2 }),
  startsAt: timestamp("startsAt").notNull(),
  endsAt: timestamp("endsAt"),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("promotion_campaigns_schedule_idx").on(table.isActive, table.startsAt, table.endsAt)]);

/** Many-to-many campaign assignments; one product may be assigned to multiple schedules. */
export const promotionCampaignProducts = mysqlTable("promotion_campaign_products", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull().references(() => promotionCampaigns.id),
  productId: int("productId").notNull().references(() => catalogueProducts.id),
  discountPercent: decimal("discountPercent", { precision: 5, scale: 2 }),
  fixedPriceEur: decimal("fixedPriceEur", { precision: 10, scale: 2 }),
  startsAt: timestamp("startsAt"),
  endsAt: timestamp("endsAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("promotion_campaign_products_campaign_idx").on(table.campaignId), index("promotion_campaign_products_product_idx").on(table.productId)]);

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
  region: varchar("region", { length: 160 }),
  city: varchar("city", { length: 160 }).notNull(),
  postcode: varchar("postcode", { length: 20 }).notNull(),
  invoiceRequested: boolean("invoiceRequested").default(false).notNull(),
  invoiceCompanyName: varchar("invoiceCompanyName", { length: 255 }),
  invoiceEik: varchar("invoiceEik", { length: 32 }),
  invoiceVatNumber: varchar("invoiceVatNumber", { length: 32 }),
  invoiceMol: varchar("invoiceMol", { length: 255 }),
  invoiceRegion: varchar("invoiceRegion", { length: 160 }),
  invoiceCity: varchar("invoiceCity", { length: 160 }),
  invoicePostcode: varchar("invoicePostcode", { length: 20 }),
  invoiceAddress: text("invoiceAddress"),
  invoiceAddressAdditional: text("invoiceAddressAdditional"),
  invoiceAdditionalInfo: text("invoiceAdditionalInfo"),
  status: mysqlEnum("status", ["new", "contacted", "confirmed", "closed", "cancelled"]).default("new").notNull(),
  adminNote: text("adminNote"),
  isDeleted: boolean("isDeleted").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("order_requests_status_created_idx").on(table.status, table.createdAt)]);

/** Items belonging to a public order request; legacy order_requests rows remain readable without child items. */
export const orderRequestItems = mysqlTable("order_request_items", {
  id: int("id").autoincrement().primaryKey(),
  orderRequestId: int("orderRequestId").notNull().references(() => orderRequests.id),
  productId: int("productId").references(() => catalogueProducts.id),
  productName: varchar("productName", { length: 500 }).notNull(),
  productSku: varchar("productSku", { length: 96 }),
  productImageUrl: text("productImageUrl").notNull(),
  parametersJson: text("parametersJson"),
  quantity: int("quantity").notNull(),
  priceEur: decimal("priceEur", { precision: 10, scale: 2 }),
  totalEur: decimal("totalEur", { precision: 10, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("order_request_items_request_idx").on(table.orderRequestId), index("order_request_items_product_idx").on(table.productId)]);

/** Immutable status/comment events for order requests; authorName preserves the display name at write time. */
export const orderStatusHistory = mysqlTable("order_status_history", {
  id: int("id").autoincrement().primaryKey(),
  orderRequestId: int("orderRequestId").notNull().references(() => orderRequests.id),
  status: mysqlEnum("status", ["new", "contacted", "confirmed", "closed", "cancelled"]).notNull(),
  comment: text("comment"),
  authorId: int("authorId").references(() => users.id),
  authorName: varchar("authorName", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("order_status_history_request_created_idx").on(table.orderRequestId, table.createdAt)]);

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
  isDeleted: boolean("isDeleted").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("contact_enquiries_status_created_idx").on(table.status, table.createdAt)]);

/** Immutable status/comment history for contact enquiries. */
export const contactEnquiryHistory = mysqlTable("contact_enquiry_history", {
  id: int("id").autoincrement().primaryKey(),
  contactEnquiryId: int("contactEnquiryId").notNull().references(() => contactEnquiries.id),
  status: mysqlEnum("status", ["new", "contacted", "closed"]).notNull(),
  comment: text("comment"),
  authorId: int("authorId").references(() => users.id),
  authorName: varchar("authorName", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("contact_enquiry_history_enquiry_created_idx").on(table.contactEnquiryId, table.createdAt)]);

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
export type CustomerProfile = typeof customerProfiles.$inferSelect;
export type CustomerAddress = typeof customerAddresses.$inferSelect;
export type CustomerCredential = typeof customerCredentials.$inferSelect;
export type CustomerActivationToken = typeof customerActivationTokens.$inferSelect;
export type LegacyCustomerOrder = typeof legacyCustomerOrders.$inferSelect;
export type LegacyCustomerOrderLine = typeof legacyCustomerOrderLines.$inferSelect;
export type CatalogueCategory = typeof catalogueCategories.$inferSelect;
export type CatalogueProduct = typeof catalogueProducts.$inferSelect;
export type CatalogueProductEnglish = typeof catalogueProductEnglish.$inferSelect;
export type CatalogueCategoryEnglish = typeof catalogueCategoryEnglish.$inferSelect;
export type CatalogueManufacturer = typeof catalogueManufacturers.$inferSelect;
export type CatalogueProductCategoryLink = typeof catalogueProductCategoryLinks.$inferSelect;
export type OrderRequest = typeof orderRequests.$inferSelect;
export type OrderRequestItem = typeof orderRequestItems.$inferSelect;
export type OrderStatusHistory = typeof orderStatusHistory.$inferSelect;
export type ContactEnquiry = typeof contactEnquiries.$inferSelect;
export type ContactEnquiryHistory = typeof contactEnquiryHistory.$inferSelect;
export type CatalogueBrochure = typeof catalogueBrochures.$inferSelect;

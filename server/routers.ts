import { additionalCustomerProcedures, assertCustomerSameOrigin } from "./customerAuthRouter";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { administratorOnlyProcedure, permissionProcedure, anyPermissionProcedure } from "./permissionProcedures";
import { enqueueAiGeneration, generateAdminAiContent, getAdminAiCategories, getAdminAiContent, getAdminAiProductIds, getAdminAiQueueStatus, getAdminAiSettings, reviewAdminAiContent, saveAdminAiContent, saveAdminAiSettings, setAdminAiQueueStatus } from "./aiContentService";
import { accessRouter, staffRouter } from "./accessRouter";
import { productPayloadSchema } from "../shared/productValidation";
import { categoryPayloadSchema } from "../shared/categoryValidation";
export { productPayloadSchema } from "../shared/productValidation";
export { categoryPayloadSchema } from "../shared/categoryValidation";
import {
  adjustProductStock,
  createAdminProduct,
  createContactEnquiry,
  createOrderRequest,
  deleteContactEnquiry,
  deleteOrderRequest,
  getAdminContactEnquiryDetail,
  getAdminContactEnquiries,
  getAdminCategories,
  getAdminProductCategories,
  getAdminBrochures,
  getAdminOrders,
  getAdminOrderDetail,
  getAdminInventoryProducts,
  getAdminProducts,
  getAdminSummary,
  getAdminOperations,
  getAdminPromotionCampaigns,
  getAdminPromotionProducts,
  getPublicCatalogue,
  getPublicCatalogueMetadata,
  getPublicCataloguePage,
  getPublicBestSellers,
  getPublicProductBySlug,
  getPublicProductsBySlugs,
  getPublicBrochure,
  activateAdminBrochure,
  archiveAdminBrochure,
  replaceAdminBrochure,
  uploadBrochurePage,
  saveAdminCategory,
  saveProductStockChanges,
  setAdminCategoryArchived,
  saveProductPromotion,
  createPromotionCampaign,
  deletePromotionCampaign,
  setPromotionCampaignActive,
  updatePromotionCampaign,
  setAdminProductArchived,
  setAdminProductsActive,
  updateAdminProduct,
  updateContactEnquiry,
  updateOrderRequest,
  uploadAdminBrochure,
  uploadProductImage,
  uploadCategoryImage,
  logAdminActivity,
} from "./catalogueService";
import {
  activateCustomerAccount,
  clearCustomerSession,
  getCustomerFromRequest,
  importLegacyCustomers,
  loginCustomer,
  previewLegacyCustomerWorkbook,
} from "./customerAccounts";
import { importLegacyOrders, previewLegacyOrders } from "./legacyOrders";

const availabilitySchema = z.enum(["in_stock", "on_request", "out_of_stock"]);
const orderStatusSchema = z.enum(["new", "contacted", "confirmed", "closed", "cancelled"]);
const contactEnquiryStatusSchema = z.enum(["new", "contacted", "closed"]);
const catalogueSortSchema = z.enum(["relevance", "price-asc", "price-desc", "name-asc", "name-desc"]);
const catalogueLanguageSchema = z.enum(["bg", "en"]);
const aiContentStatusSchema = z.enum(["pending", "generated", "reviewed", "published", "error"]);
const aiContentConfidenceSchema = z.enum(["high", "low"]);
const publicCatalogueLanguageInput = z.object({ language: catalogueLanguageSchema }).optional();
const publicCataloguePageSchema = z.object({
  language: catalogueLanguageSchema.optional(),
  promotion: z.boolean().optional(),
  page: z.number().int().min(1).max(10_000),
  pageSize: z.number().int().min(1).max(48),
  categorySlug: z.string().trim().min(3).max(128).regex(/^[a-z0-9-]+$/).optional(),
  path: z.array(z.string().trim().min(1).max(160)).max(4).optional(),
  query: z.string().trim().min(1).max(160).optional(),
  brand: z.string().trim().min(1).max(160).optional(),
  brands: z.array(z.string().trim().min(1).max(160)).min(1).max(30).optional(),
  availability: z.array(availabilitySchema).max(3).optional(),
  minPrice: z.number().nonnegative().max(1_000_000).optional(),
  maxPrice: z.number().nonnegative().max(1_000_000).optional(),
  sort: catalogueSortSchema.optional(),
});
export const appRouter = router({
  system: systemRouter,
  staff: staffRouter,
  access: accessRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  catalogue: router({
    list: publicProcedure.input(publicCatalogueLanguageInput).query(({ input }) => getPublicCatalogue(input?.language)),
    metadata: publicProcedure.input(publicCatalogueLanguageInput).query(({ input }) => getPublicCatalogueMetadata(input?.language)),
    page: publicProcedure.input(publicCataloguePageSchema).query(({ input }) => getPublicCataloguePage(input)),
    bestSellers: publicProcedure.input(publicCatalogueLanguageInput).query(({ input }) => getPublicBestSellers(8, input?.language)),
    product: publicProcedure.input(z.object({ slug: z.string().trim().min(3).max(160).regex(/^[a-z0-9-]+$/), language: catalogueLanguageSchema.optional() })).query(({ input }) => getPublicProductBySlug(input.slug, input.language)),
    productsBySlugs: publicProcedure.input(z.object({ slugs: z.array(z.string().trim().min(3).max(160).regex(/^[a-z0-9-]+$/)).min(1).max(99), language: catalogueLanguageSchema.optional() })).query(({ input }) => getPublicProductsBySlugs(input.slugs, input.language)),
    brochure: publicProcedure.query(() => getPublicBrochure()),
    createOrderRequest: publicProcedure.input(z.object({
      items: z.array(z.object({ productSlug: z.string().trim().min(3).max(160), quantity: z.number().int().min(1).max(99) })).min(1).max(99).optional(),
      productSlug: z.string().trim().min(3).max(160).optional(),
      quantity: z.number().int().min(1).max(99).optional(),
      fullName: z.string().trim().min(3).max(255),
      email: z.string().trim().email().max(320),
      phone: z.string().trim().min(7).max(64),
      address: z.string().trim().min(6).max(1200),
      region: z.string().trim().min(2).max(160).optional(),
      city: z.string().trim().min(2).max(160),
      postcode: z.string().trim().min(4).max(20),
      invoiceRequested: z.boolean().default(false),
      invoiceCompanyName: z.string().trim().min(2).max(255).nullable().optional(),
      invoiceEik: z.string().trim().regex(/^(?:\d{9}|\d{13})$/, "EIK/BULSTAT must contain exactly 9 or 13 digits").nullable().optional(),
      invoiceVatNumber: z.string().trim().max(32).nullable().optional(),
      invoiceMol: z.string().trim().min(2).max(255).nullable().optional(),
      invoiceRegion: z.string().trim().min(2).max(160).nullable().optional(),
      invoiceCity: z.string().trim().min(2).max(160).nullable().optional(),
      invoicePostcode: z.string().trim().regex(/^\d{4}$/).nullable().optional(),
      invoiceAddress: z.string().trim().min(3).max(1200).nullable().optional(),
      invoiceAddressAdditional: z.string().trim().max(1200).nullable().optional(),
      invoiceAdditionalInfo: z.string().trim().max(4000).nullable().optional(),
    }).refine((input) => Boolean(input.items?.length || (input.productSlug && input.quantity)), { message: "At least one product is required", path: ["items"] }).superRefine((input, ctx) => {
      if (!input.invoiceRequested) return;
      const required: Array<[keyof typeof input, string]> = [
        ["invoiceCompanyName", "Company name is required"],
        ["invoiceEik", "EIK/BULSTAT is required"],
        ["invoiceMol", "Authorized person is required"],
        ["invoiceRegion", "Invoice region is required"],
        ["invoiceCity", "Invoice city is required"],
        ["invoicePostcode", "Invoice postcode is required"],
        ["invoiceAddress", "Invoice address is required"],
      ];
      for (const [path, message] of required) if (!input[path]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    })).mutation(({ input }) => createOrderRequest(input)),
  }),
  contact: router({
    createEnquiry: publicProcedure.input(z.object({
      fullName: z.string().trim().min(3).max(255),
      email: z.string().trim().email().max(320),
      phone: z.string().trim().min(7).max(64).nullable().optional(),
      subject: z.string().trim().min(3).max(160),
      message: z.string().trim().min(10).max(5000),
    })).mutation(({ input }) => createContactEnquiry(input)),
  }),
  customer: router({
    ...additionalCustomerProcedures,
    me: publicProcedure.query(({ ctx }) => getCustomerFromRequest(ctx.req.headers.cookie)),
    login: publicProcedure.input(z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(256) })).mutation(({ input, ctx }) => { assertCustomerSameOrigin(ctx.req); return loginCustomer(input.email, input.password, ctx.res); }),
    activate: publicProcedure.input(z.object({ token: z.string().trim().min(32).max(160), password: z.string().min(12).max(256) })).mutation(({ input, ctx }) => { assertCustomerSameOrigin(ctx.req); return activateCustomerAccount(input.token, input.password, ctx.res); }),
    logout: publicProcedure.mutation(({ ctx }) => { clearCustomerSession(ctx.res); return { success: true } as const; }),
  }),
  admin: router({
    aiContent: administratorOnlyProcedure().input(z.object({ status: aiContentStatusSchema.optional(), confidence: aiContentConfidenceSchema.optional(), query: z.string().trim().max(160).optional(), page: z.number().int().min(1).max(100000).default(1), pageSize: z.number().int().min(1).max(100).default(50) }).optional()).query(({ input }) => getAdminAiContent(input)),
    aiSettings: administratorOnlyProcedure().query(() => getAdminAiSettings()),
    saveAiSettings: administratorOnlyProcedure().input(z.object({ systemPrompt: z.string().trim().min(20).max(100_000), dailyGenerationLimit: z.number().int().min(0).max(100_000) })).mutation(({ input }) => saveAdminAiSettings(input.systemPrompt, input.dailyGenerationLimit)),
    generateAiContent: administratorOnlyProcedure().input(z.object({ productId: z.number().int().positive() })).mutation(({ input }) => generateAdminAiContent(input.productId)),
    aiCategories: administratorOnlyProcedure().query(() => getAdminAiCategories()),
    aiProductIds: administratorOnlyProcedure().input(z.object({ status: aiContentStatusSchema.optional(), confidence: aiContentConfidenceSchema.optional(), query: z.string().trim().max(160).optional(), categoryId: z.number().int().positive().optional() }).optional()).query(({ input }) => getAdminAiProductIds(input)),
    aiQueue: administratorOnlyProcedure().input(z.object({ batchId: z.number().int().positive().optional() }).optional()).query(({ input }) => getAdminAiQueueStatus(input?.batchId)),
    enqueueAiGeneration: administratorOnlyProcedure().input(z.object({ productIds: z.array(z.number().int().positive()).min(1).max(10_000) })).mutation(({ input, ctx }) => enqueueAiGeneration({ productIds: input.productIds, createdBy: ctx.user?.id ?? null })),
    setAiQueueStatus: administratorOnlyProcedure().input(z.object({ batchId: z.number().int().positive(), status: z.enum(["paused", "queued"]) })).mutation(({ input }) => setAdminAiQueueStatus(input.batchId, input.status)),
    saveAiContent: administratorOnlyProcedure().input(z.object({
      productId: z.number().int().positive(),
      aiStatus: aiContentStatusSchema,
      aiDescription: z.string().max(50_000).nullable().optional(),
      aiFeatures: z.string().max(50_000).nullable().optional(),
      aiSeoTitle: z.string().max(500).nullable().optional(),
      aiSeoDescription: z.string().max(10_000).nullable().optional(),
      aiKeywords: z.string().max(1_000).nullable().optional(),
      aiSourceUrls: z.array(z.string().url()).max(50).optional(),
      aiConfidence: aiContentConfidenceSchema.nullable().optional(),
      aiError: z.string().max(10_000).nullable().optional(),
      aiGeneratedAt: z.string().datetime().nullable().optional(),
    })).mutation(({ input }) => saveAdminAiContent(input)),
    reviewAiContent: administratorOnlyProcedure().input(z.object({ productId: z.number().int().positive(), action: z.enum(["approve", "reject"]) })).mutation(({ input }) => reviewAdminAiContent(input.productId, input.action)),
    summary: permissionProcedure("dashboard.read").query(async ({ ctx }) => { const summary = await getAdminSummary(); return { ...summary, recentOrders: ctx.staff.permissions.includes("orders.read") ? summary.recentOrders : [] }; }),
    operations: anyPermissionProcedure(["dashboard.read", "products.read", "inventory.read", "promotions.read", "orders.read", "activity.read"]).query(({ ctx }) => getAdminOperations(ctx.staff.permissions)),
    products: anyPermissionProcedure(["products.read", "inventory.read", "promotions.read"]).input(z.object({ includeArchived: z.boolean().optional() }).optional()).query(({ input }) => getAdminProducts(input)),
    promotionCampaigns: permissionProcedure("promotions.read").query(() => getAdminPromotionCampaigns()),
    promotionProducts: permissionProcedure("promotions.read").input(z.object({ categoryId: z.number().int().positive().optional() }).optional()).query(({ input }) => getAdminPromotionProducts(input?.categoryId)),
    promotionCategories: permissionProcedure("promotions.read").query(() => getAdminProductCategories()),
    inventory: permissionProcedure("inventory.read").input(z.object({ query: z.string().trim().max(160).optional(), categoryId: z.number().int().positive().optional() }).optional()).query(({ input }) => getAdminInventoryProducts(input)),
    categories: permissionProcedure("categories.read").input(z.object({ includeArchived: z.boolean().optional() }).optional()).query(({ input }) => getAdminCategories(input)),
    productCategories: anyPermissionProcedure(["categories.read", "products.write"]).query(() => getAdminProductCategories()),
    orders: permissionProcedure("orders.read").query(() => getAdminOrders()),
    orderDetail: permissionProcedure("orders.read").input(z.object({ id: z.number().int().positive() })).query(({ input }) => getAdminOrderDetail(input.id)),
    contactEnquiries: permissionProcedure("enquiries.read").query(() => getAdminContactEnquiries()),
    contactEnquiryDetail: permissionProcedure("enquiries.read").input(z.object({ id: z.number().int().positive() })).query(({ input }) => getAdminContactEnquiryDetail(input.id)),
    brochures: permissionProcedure("brochures.read").query(() => getAdminBrochures()),
    previewLegacyCustomerImport: permissionProcedure("customers.read").input(z.object({ workbookData: z.string().min(32).max(12_000_000) })).mutation(({ input }) => previewLegacyCustomerWorkbook(input.workbookData)),
    importLegacyCustomers: permissionProcedure("customers.import").input(z.object({ workbookData: z.string().min(32).max(12_000_000) })).mutation(async ({ input, ctx }) => {
      const result = await importLegacyCustomers(input.workbookData, ctx.user.id);
      await logAdminActivity(ctx.user.id, "customer_profiles.imported", "customer_profile_import", null, { importedProfiles: result.importedProfiles, importedAddresses: result.importedAddresses, pendingActivation: result.pendingActivation, disabledProfiles: result.disabledProfiles });
      return result;
    }),
    previewLegacyOrderImport: permissionProcedure("legacy_orders.read").input(z.object({ csvData: z.string().min(32).max(12_000_000) })).mutation(({ input }) => previewLegacyOrders(input.csvData)),
    importLegacyOrders: permissionProcedure("legacy_orders.import").input(z.object({ csvData: z.string().min(32).max(12_000_000) })).mutation(async ({ input, ctx }) => {
      const result = await importLegacyOrders(input.csvData);
      await logAdminActivity(ctx.user.id, "customer_orders.imported", "legacy_customer_order_import", null, { importedOrders: result.importedOrders, importedOrderLines: result.importedOrderLines, linkedByLegacyCustomerId: result.linkedByLegacyCustomerId, linkedByEmail: result.linkedByEmail, unlinkedGuestOrRemoved: result.unlinkedGuestOrRemoved });
      return result;
    }),
    createProduct: permissionProcedure("products.write").input(productPayloadSchema).mutation(({ input, ctx }) => createAdminProduct(input, ctx.staff.id ?? ctx.user.id)),
    updateProduct: permissionProcedure("products.write").input(z.object({ id: z.number().int().positive(), product: productPayloadSchema })).mutation(({ input, ctx }) => updateAdminProduct(input.id, input.product, ctx.staff.id ?? ctx.user.id)),
    setProductArchived: permissionProcedure("products.write").input(z.object({ id: z.number().int().positive(), archived: z.boolean() })).mutation(({ input, ctx }) => { const actorId = ctx.staff.id; if (!actorId) throw new Error("Липсва идентичност на оператора."); return setAdminProductArchived(input.id, input.archived, actorId); }),
    setProductsActive: permissionProcedure("products.write").input(z.object({ ids: z.array(z.number().int().positive()).min(1).max(10_000), isActive: z.boolean() })).mutation(({ input, ctx }) => { const actorId = ctx.staff.id; if (!actorId) throw new Error("Липсва идентичност на оператора."); return setAdminProductsActive(input.ids, input.isActive, actorId); }),
    adjustStock: permissionProcedure("inventory.write").input(z.object({ id: z.number().int().positive(), delta: z.number().int().min(-999999).max(999999).refine((value) => value !== 0) })).mutation(({ input, ctx }) => adjustProductStock(input.id, input.delta, ctx.user.id)),
    saveStockChanges: permissionProcedure("inventory.write").input(z.object({ changes: z.array(z.object({ id: z.number().int().positive(), stockQuantity: z.number().int().min(0).max(999999) })).min(1).max(100).superRefine((items, ctx) => { if (new Set(items.map(item => item.id)).size !== items.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Един артикул е добавен повече от веднъж." }); }) })).mutation(({ input, ctx }) => saveProductStockChanges(input.changes, ctx.user.id)),
    savePromotion: permissionProcedure("promotions.write").input(z.object({ id: z.number().int().positive(), priceEur: z.number().nonnegative().nullable(), oldPriceEur: z.number().nonnegative().nullable(), discountLabel: z.string().trim().max(48).nullable() })).mutation(({ input, ctx }) => saveProductPromotion(input, ctx.user.id)),
    createPromotionCampaign: permissionProcedure("promotions.write").input(z.object({ name: z.string().trim().min(2).max(160), discountPercent: z.number().positive().max(100).nullable().optional(), fixedPriceEur: z.number().nonnegative().nullable().optional(), startsAt: z.string().datetime(), endsAt: z.string().datetime().nullable().optional(), productIds: z.array(z.number().int().positive()).min(1).max(1000), productOverrides: z.array(z.object({ productId: z.number().int().positive(), discountPercent: z.number().positive().max(100).nullable().optional(), fixedPriceEur: z.number().nonnegative().nullable().optional(), startsAt: z.string().datetime().nullable().optional(), endsAt: z.string().datetime().nullable().optional() })).max(1000).optional() })).mutation(({ input, ctx }) => createPromotionCampaign(input, ctx.staff.id ?? ctx.user.id)),
    updatePromotionCampaign: permissionProcedure("promotions.write").input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(2).max(160), discountPercent: z.number().positive().max(100).nullable().optional(), fixedPriceEur: z.number().nonnegative().nullable().optional(), startsAt: z.string().datetime(), endsAt: z.string().datetime().nullable().optional(), productIds: z.array(z.number().int().positive()).min(1).max(1000), productOverrides: z.array(z.object({ productId: z.number().int().positive(), discountPercent: z.number().positive().max(100).nullable().optional(), fixedPriceEur: z.number().nonnegative().nullable().optional(), startsAt: z.string().datetime().nullable().optional(), endsAt: z.string().datetime().nullable().optional() })).max(1000).optional() })).mutation(({ input, ctx }) => updatePromotionCampaign(input.id, input, ctx.staff.id ?? ctx.user.id)),
    deletePromotionCampaign: permissionProcedure("promotions.write").input(z.object({ id: z.number().int().positive() })).mutation(({ input, ctx }) => deletePromotionCampaign(input.id, ctx.staff.id ?? ctx.user.id)),
    setPromotionCampaignActive: permissionProcedure("promotions.write").input(z.object({ id: z.number().int().positive(), isActive: z.boolean() })).mutation(({ input, ctx }) => setPromotionCampaignActive(input.id, input.isActive, ctx.staff.id ?? ctx.user.id)),
    uploadProductImage: permissionProcedure("products.write").input(z.object({ dataUrl: z.string().min(32).max(15_000_000), fileName: z.string().trim().min(1).max(160) })).mutation(({ input, ctx }) => uploadProductImage(input, ctx.staff.id ?? ctx.user.id)),
    uploadBrochure: permissionProcedure("brochures.write").input(z.object({ title: z.string().trim().min(3).max(255), sourcePdf: z.object({ dataUrl: z.string().min(32).max(28_000_000), fileName: z.string().trim().min(1).max(160) }).optional(), pages: z.array(z.object({ dataUrl: z.string().min(32).max(4_500_000), fileName: z.string().trim().min(1).max(160) })).min(1).max(16) })).mutation(({ input, ctx }) => uploadAdminBrochure(input, ctx.user.id)),
    uploadBrochurePage: permissionProcedure("brochures.write").input(z.object({ dataUrl: z.string().min(32).max(4_500_000), fileName: z.string().trim().min(1).max(160) })).mutation(({ input, ctx }) => uploadBrochurePage(input, ctx.user.id)),
    replaceBrochure: permissionProcedure("brochures.write").input(z.object({ title: z.string().trim().min(3).max(255), pageUrls: z.array(z.string().startsWith("/manus-storage/")).min(1).max(16) })).mutation(({ input, ctx }) => replaceAdminBrochure(input, ctx.user.id)),
    activateBrochure: permissionProcedure("brochures.write").input(z.object({ id: z.number().int().positive() })).mutation(({ input, ctx }) => activateAdminBrochure(input.id, ctx.user.id)),
    archiveBrochure: permissionProcedure("brochures.write").input(z.object({ id: z.number().int().positive() })).mutation(({ input, ctx }) => archiveAdminBrochure(input.id, ctx.user.id)),
    saveCategory: permissionProcedure("categories.write").input(z.object({ id: z.number().int().positive().optional(), category: categoryPayloadSchema })).mutation(({ input, ctx }) => saveAdminCategory(input.id, input.category, ctx.staff.id ?? ctx.user.id)),
    archiveCategory: permissionProcedure("categories.write").input(z.object({ id: z.number().int().positive() })).mutation(({ input, ctx }) => { const actorId = ctx.staff.id; if (!actorId) throw new Error("Липсва идентичност на оператора."); return setAdminCategoryArchived(input.id, true, actorId); }),
    restoreCategory: permissionProcedure("categories.write").input(z.object({ id: z.number().int().positive() })).mutation(({ input, ctx }) => { const actorId = ctx.staff.id; if (!actorId) throw new Error("Липсва идентичност на оператора."); return setAdminCategoryArchived(input.id, false, actorId); }),
    uploadCategoryImage: permissionProcedure("categories.write").input(z.object({ dataUrl: z.string().min(32).max(15_000_000), fileName: z.string().trim().min(1).max(160) })).mutation(({ input, ctx }) => uploadCategoryImage(input, ctx.staff.id ?? ctx.user.id)),
    updateOrder: permissionProcedure("orders.write").input(z.object({ id: z.number().int().positive(), status: orderStatusSchema, adminNote: z.string().trim().max(4000).nullable() })).mutation(({ input, ctx }) => { const actorId = ctx.staff.id; if (!actorId) throw new Error("Липсва идентичност на оператора."); return updateOrderRequest(input.id, input.status, input.adminNote, actorId, ctx.staff.name); }),
    updateContactEnquiry: permissionProcedure("enquiries.write").input(z.object({ id: z.number().int().positive(), status: contactEnquiryStatusSchema, adminNote: z.string().trim().max(4000).nullable() })).mutation(({ input, ctx }) => updateContactEnquiry(input.id, input.status, input.adminNote, ctx.staff.id ?? ctx.user.id, ctx.staff.name)),
    deleteOrder: permissionProcedure("orders.write").input(z.object({ id: z.number().int().positive() })).mutation(({ input, ctx }) => { const actorId = ctx.staff.id; if (!actorId) throw new Error("Липсва идентичност на оператора."); return deleteOrderRequest(input.id, actorId, ctx.staff.name); }),
    deleteContactEnquiry: permissionProcedure("enquiries.write").input(z.object({ id: z.number().int().positive() })).mutation(({ input, ctx }) => deleteContactEnquiry(input.id, ctx.staff.id ?? ctx.user.id, ctx.staff.name)),
  }),
});

export type AppRouter = typeof appRouter;

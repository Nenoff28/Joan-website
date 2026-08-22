import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import {
  adjustProductStock,
  createAdminProduct,
  createContactEnquiry,
  createOrderRequest,
  getAdminContactEnquiries,
  getAdminCategories,
  getAdminBrochures,
  getAdminOrders,
  getAdminProducts,
  getAdminSummary,
  getAdminOperations,
  getPublicCatalogue,
  getPublicCatalogueMetadata,
  getPublicCataloguePage,
  getPublicProductBySlug,
  getPublicProductsBySlugs,
  getPublicBrochure,
  activateAdminBrochure,
  archiveAdminBrochure,
  replaceAdminBrochure,
  uploadBrochurePage,
  saveAdminCategory,
  saveProductPromotion,
  updateAdminProduct,
  updateContactEnquiry,
  updateOrderRequest,
  uploadAdminBrochure,
  uploadProductImage,
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
const publicCataloguePageSchema = z.object({
  page: z.number().int().min(1).max(10_000),
  pageSize: z.number().int().min(1).max(48),
  categorySlug: z.string().trim().min(3).max(128).regex(/^[a-z0-9-]+$/).optional(),
  path: z.array(z.string().trim().min(1).max(160)).max(4).optional(),
  query: z.string().trim().min(1).max(160).optional(),
  brand: z.string().trim().min(1).max(160).optional(),
  availability: z.array(availabilitySchema).max(3).optional(),
  minPrice: z.number().nonnegative().max(1_000_000).optional(),
  maxPrice: z.number().nonnegative().max(1_000_000).optional(),
  sort: catalogueSortSchema.optional(),
});
type CategoryNodeInput = { label: string; children?: CategoryNodeInput[] };
const categoryNodeSchema: z.ZodType<CategoryNodeInput> = z.lazy(() => z.object({
  label: z.string().trim().min(1).max(160),
  children: z.array(categoryNodeSchema).max(24).optional(),
}));

const productPayloadSchema = z.object({
  categoryId: z.number().int().positive(),
  slug: z.string().trim().min(3).max(160).regex(/^[a-z0-9-]+$/),
  sku: z.string().trim().max(96).nullable().optional(),
  brand: z.string().trim().max(160).nullable().optional(),
  name: z.string().trim().min(3).max(500),
  description: z.string().trim().min(10),
  imageUrl: z.string().trim().min(1),
  gallery: z.array(z.string().trim().min(1)).min(1).max(10),
  imageAlt: z.string().trim().min(3),
  priceEur: z.number().nonnegative().nullable().optional(),
  oldPriceEur: z.number().nonnegative().nullable().optional(),
  discountLabel: z.string().trim().max(48).nullable().optional(),
  availability: availabilitySchema,
  stockQuantity: z.number().int().min(0).max(999999),
  features: z.array(z.string().trim().min(1).max(180)).max(12),
  isActive: z.boolean(),
});

const categoryPayloadSchema = z.object({
  slug: z.string().trim().min(3).max(128).regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(2).max(255),
  description: z.string().trim().min(10),
  imageUrl: z.string().trim().min(1),
  icon: z.string().trim().min(2).max(64),
  subcategories: z.array(categoryNodeSchema).max(24),
  sortOrder: z.number().int().min(0).max(999),
  isActive: z.boolean(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  catalogue: router({
    list: publicProcedure.query(() => getPublicCatalogue()),
    metadata: publicProcedure.query(() => getPublicCatalogueMetadata()),
    page: publicProcedure.input(publicCataloguePageSchema).query(({ input }) => getPublicCataloguePage(input)),
    product: publicProcedure.input(z.object({ slug: z.string().trim().min(3).max(160).regex(/^[a-z0-9-]+$/) })).query(({ input }) => getPublicProductBySlug(input.slug)),
    productsBySlugs: publicProcedure.input(z.object({ slugs: z.array(z.string().trim().min(3).max(160).regex(/^[a-z0-9-]+$/)).min(1).max(99) })).query(({ input }) => getPublicProductsBySlugs(input.slugs)),
    brochure: publicProcedure.query(() => getPublicBrochure()),
    createOrderRequest: publicProcedure.input(z.object({
      productSlug: z.string().trim().min(3).max(160),
      quantity: z.number().int().min(1).max(99),
      fullName: z.string().trim().min(3).max(255),
      email: z.string().trim().email().max(320),
      phone: z.string().trim().min(7).max(64),
      address: z.string().trim().min(6).max(1200),
      city: z.string().trim().min(2).max(160),
      postcode: z.string().trim().min(4).max(20),
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
    me: publicProcedure.query(({ ctx }) => getCustomerFromRequest(ctx.req.headers.cookie)),
    login: publicProcedure.input(z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(256) })).mutation(({ input, ctx }) => loginCustomer(input.email, input.password, ctx.res)),
    activate: publicProcedure.input(z.object({ token: z.string().trim().min(32).max(160), password: z.string().min(12).max(256) })).mutation(({ input, ctx }) => activateCustomerAccount(input.token, input.password, ctx.res)),
    logout: publicProcedure.mutation(({ ctx }) => { clearCustomerSession(ctx.res); return { success: true } as const; }),
  }),
  admin: router({
    summary: adminProcedure.query(() => getAdminSummary()),
    operations: adminProcedure.query(() => getAdminOperations()),
    products: adminProcedure.query(() => getAdminProducts()),
    categories: adminProcedure.query(() => getAdminCategories()),
    orders: adminProcedure.query(() => getAdminOrders()),
    contactEnquiries: adminProcedure.query(() => getAdminContactEnquiries()),
    brochures: adminProcedure.query(() => getAdminBrochures()),
    previewLegacyCustomerImport: adminProcedure.input(z.object({ workbookData: z.string().min(32).max(12_000_000) })).mutation(({ input }) => previewLegacyCustomerWorkbook(input.workbookData)),
    importLegacyCustomers: adminProcedure.input(z.object({ workbookData: z.string().min(32).max(12_000_000) })).mutation(async ({ input, ctx }) => {
      const result = await importLegacyCustomers(input.workbookData, ctx.user.id);
      await logAdminActivity(ctx.user.id, "customer_profiles.imported", "customer_profile_import", null, { importedProfiles: result.importedProfiles, importedAddresses: result.importedAddresses, pendingActivation: result.pendingActivation, disabledProfiles: result.disabledProfiles });
      return result;
    }),
    previewLegacyOrderImport: adminProcedure.input(z.object({ csvData: z.string().min(32).max(12_000_000) })).mutation(({ input }) => previewLegacyOrders(input.csvData)),
    importLegacyOrders: adminProcedure.input(z.object({ csvData: z.string().min(32).max(12_000_000) })).mutation(async ({ input, ctx }) => {
      const result = await importLegacyOrders(input.csvData);
      await logAdminActivity(ctx.user.id, "customer_orders.imported", "legacy_customer_order_import", null, { importedOrders: result.importedOrders, importedOrderLines: result.importedOrderLines, linkedByLegacyCustomerId: result.linkedByLegacyCustomerId, linkedByEmail: result.linkedByEmail, unlinkedGuestOrRemoved: result.unlinkedGuestOrRemoved });
      return result;
    }),
    createProduct: adminProcedure.input(productPayloadSchema).mutation(({ input, ctx }) => createAdminProduct(input, ctx.user.id)),
    updateProduct: adminProcedure.input(z.object({ id: z.number().int().positive(), product: productPayloadSchema })).mutation(({ input, ctx }) => updateAdminProduct(input.id, input.product, ctx.user.id)),
    adjustStock: adminProcedure.input(z.object({ id: z.number().int().positive(), delta: z.number().int().min(-999999).max(999999).refine((value) => value !== 0) })).mutation(({ input, ctx }) => adjustProductStock(input.id, input.delta, ctx.user.id)),
    savePromotion: adminProcedure.input(z.object({ id: z.number().int().positive(), priceEur: z.number().nonnegative().nullable(), oldPriceEur: z.number().nonnegative().nullable(), discountLabel: z.string().trim().max(48).nullable() })).mutation(({ input, ctx }) => saveProductPromotion(input, ctx.user.id)),
    uploadProductImage: adminProcedure.input(z.object({ dataUrl: z.string().min(32).max(6_000_000), fileName: z.string().trim().min(1).max(160) })).mutation(({ input, ctx }) => uploadProductImage(input, ctx.user.id)),
    uploadBrochure: adminProcedure.input(z.object({ title: z.string().trim().min(3).max(255), sourcePdf: z.object({ dataUrl: z.string().min(32).max(28_000_000), fileName: z.string().trim().min(1).max(160) }).optional(), pages: z.array(z.object({ dataUrl: z.string().min(32).max(4_500_000), fileName: z.string().trim().min(1).max(160) })).min(1).max(16) })).mutation(({ input, ctx }) => uploadAdminBrochure(input, ctx.user.id)),
    uploadBrochurePage: adminProcedure.input(z.object({ dataUrl: z.string().min(32).max(4_500_000), fileName: z.string().trim().min(1).max(160) })).mutation(({ input, ctx }) => uploadBrochurePage(input, ctx.user.id)),
    replaceBrochure: adminProcedure.input(z.object({ title: z.string().trim().min(3).max(255), pageUrls: z.array(z.string().startsWith("/manus-storage/")).min(1).max(16) })).mutation(({ input, ctx }) => replaceAdminBrochure(input, ctx.user.id)),
    activateBrochure: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input, ctx }) => activateAdminBrochure(input.id, ctx.user.id)),
    archiveBrochure: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input, ctx }) => archiveAdminBrochure(input.id, ctx.user.id)),
    saveCategory: adminProcedure.input(z.object({ id: z.number().int().positive().optional(), category: categoryPayloadSchema })).mutation(({ input, ctx }) => saveAdminCategory(input.id, input.category, ctx.user.id)),
    updateOrder: adminProcedure.input(z.object({ id: z.number().int().positive(), status: orderStatusSchema, adminNote: z.string().trim().max(4000).nullable() })).mutation(({ input, ctx }) => updateOrderRequest(input.id, input.status, input.adminNote, ctx.user.id)),
    updateContactEnquiry: adminProcedure.input(z.object({ id: z.number().int().positive(), status: contactEnquiryStatusSchema, adminNote: z.string().trim().max(4000).nullable() })).mutation(({ input, ctx }) => updateContactEnquiry(input.id, input.status, input.adminNote, ctx.user.id)),
  }),
});

export type AppRouter = typeof appRouter;

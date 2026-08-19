import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createAdminProduct,
  createOrderRequest,
  getAdminCategories,
  getAdminOrders,
  getAdminProducts,
  getAdminSummary,
  getPublicCatalogue,
  saveAdminCategory,
  updateAdminProduct,
  updateOrderRequest,
  uploadProductImage,
} from "./catalogueService";

const availabilitySchema = z.enum(["in_stock", "on_request", "out_of_stock"]);
const orderStatusSchema = z.enum(["new", "contacted", "confirmed", "closed", "cancelled"]);

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
  priceBgn: z.number().nonnegative().nullable().optional(),
  oldPriceEur: z.number().nonnegative().nullable().optional(),
  oldPriceBgn: z.number().nonnegative().nullable().optional(),
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
  subcategories: z.array(z.string().trim().min(1).max(160)).max(24),
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
  admin: router({
    summary: adminProcedure.query(() => getAdminSummary()),
    products: adminProcedure.query(() => getAdminProducts()),
    categories: adminProcedure.query(() => getAdminCategories()),
    orders: adminProcedure.query(() => getAdminOrders()),
    createProduct: adminProcedure.input(productPayloadSchema).mutation(({ input, ctx }) => createAdminProduct(input, ctx.user.id)),
    updateProduct: adminProcedure.input(z.object({ id: z.number().int().positive(), product: productPayloadSchema })).mutation(({ input, ctx }) => updateAdminProduct(input.id, input.product, ctx.user.id)),
    uploadProductImage: adminProcedure.input(z.object({ dataUrl: z.string().min(32).max(6_000_000), fileName: z.string().trim().min(1).max(160) })).mutation(({ input, ctx }) => uploadProductImage(input, ctx.user.id)),
    saveCategory: adminProcedure.input(z.object({ id: z.number().int().positive().optional(), category: categoryPayloadSchema })).mutation(({ input, ctx }) => saveAdminCategory(input.id, input.category, ctx.user.id)),
    updateOrder: adminProcedure.input(z.object({ id: z.number().int().positive(), status: orderStatusSchema, adminNote: z.string().trim().max(4000).nullable() })).mutation(({ input, ctx }) => updateOrderRequest(input.id, input.status, input.adminNote, ctx.user.id)),
  }),
});

export type AppRouter = typeof appRouter;

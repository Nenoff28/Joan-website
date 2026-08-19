import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const service = vi.hoisted(() => ({
  adjustProductStock: vi.fn(),
  createAdminProduct: vi.fn(),
  createOrderRequest: vi.fn(),
  getAdminCategories: vi.fn(),
  getAdminOrders: vi.fn(),
  getAdminProducts: vi.fn(),
  getAdminSummary: vi.fn(),
  getAdminOperations: vi.fn(),
  getPublicCatalogue: vi.fn(),
  saveAdminCategory: vi.fn(),
  saveProductPromotion: vi.fn(),
  updateAdminProduct: vi.fn(),
  updateOrderRequest: vi.fn(),
  uploadProductImage: vi.fn(),
}));

vi.mock("./catalogueService", () => service);

import { appRouter } from "./routers";

function adminContext(): TrpcContext {
  return {
    user: { id: 17, openId: "admin-test", name: "Admin", email: "admin@example.com", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

const productInput = {
  categoryId: 1,
  slug: "admin-validation-product",
  sku: "ADM-01",
  brand: "Joan",
  name: "Administrative validation product",
  description: "A valid payload used only to verify the protected procedure contract.",
  imageUrl: "/manus-storage/example.jpg",
  gallery: ["/manus-storage/example.jpg"],
  imageAlt: "Validation product image",
  priceEur: 12.5,
  priceBgn: 24.45,
  oldPriceEur: null,
  oldPriceBgn: null,
  discountLabel: null,
  availability: "in_stock" as const,
  stockQuantity: 3,
  features: ["Verified procedure input"],
  isActive: true,
};

describe("administrator management procedures", () => {
  it("passes a validated product record and authenticated administrator ID to the product service", async () => {
    service.createAdminProduct.mockResolvedValueOnce(501);
    const caller = appRouter.createCaller(adminContext());
    await expect(caller.admin.createProduct(productInput)).resolves.toBe(501);
    expect(service.createAdminProduct).toHaveBeenCalledWith(productInput, 17);
  });

  it("passes a validated order status and internal note to the protected workflow", async () => {
    service.updateOrderRequest.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(adminContext());
    await expect(caller.admin.updateOrder({ id: 9, status: "contacted", adminNote: "Customer contacted by phone." })).resolves.toBeUndefined();
    expect(service.updateOrderRequest).toHaveBeenCalledWith(9, "contacted", "Customer contacted by phone.", 17);
  });

  it("passes a bounded inventory adjustment to the authenticated administrator service", async () => {
    service.adjustProductStock.mockResolvedValueOnce({ id: 9, stockQuantity: 7 });
    const caller = appRouter.createCaller(adminContext());
    await expect(caller.admin.adjustStock({ id: 9, delta: 2 })).resolves.toEqual({ id: 9, stockQuantity: 7 });
    expect(service.adjustProductStock).toHaveBeenCalledWith(9, 2, 17);
  });

  it("passes completed price details and a promotion label to the protected promotion workflow", async () => {
    service.saveProductPromotion.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(adminContext());
    await expect(caller.admin.savePromotion({ id: 9, priceEur: 10, priceBgn: 19.56, oldPriceEur: 12, oldPriceBgn: 23.47, discountLabel: "-17%" })).resolves.toBeUndefined();
    expect(service.saveProductPromotion).toHaveBeenCalledWith({ id: 9, priceEur: 10, priceBgn: 19.56, oldPriceEur: 12, oldPriceBgn: 23.47, discountLabel: "-17%" }, 17);
  });

  it("accepts a public delivery request only after validating its contact and product fields", async () => {
    service.createOrderRequest.mockResolvedValueOnce({ requestNumber: "J-20260819-TEST1" });
    const caller = appRouter.createCaller({ ...adminContext(), user: null });
    await expect(caller.catalogue.createOrderRequest({ productSlug: "instrumenti-test-1", quantity: 1, fullName: "Catalogue customer", email: "customer@example.com", phone: "+359888111222", address: "Example address 22", city: "Silistra", postcode: "7500" })).resolves.toEqual({ requestNumber: "J-20260819-TEST1" });
  });
});

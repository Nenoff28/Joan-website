import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const service = vi.hoisted(() => ({
  adjustProductStock: vi.fn(),
  activateAdminBrochure: vi.fn(),
  archiveAdminBrochure: vi.fn(),
  createAdminProduct: vi.fn(),
  createContactEnquiry: vi.fn(),
  createOrderRequest: vi.fn(),
  getAdminContactEnquiries: vi.fn(),
  getAdminCategories: vi.fn(),
  getAdminBrochures: vi.fn(),
  getAdminOrders: vi.fn(),
  getAdminProducts: vi.fn(),
  getAdminSummary: vi.fn(),
  getAdminOperations: vi.fn(),
  getPublicCatalogue: vi.fn(),
  getPublicBrochure: vi.fn(),
  replaceAdminBrochure: vi.fn(),
  saveAdminCategory: vi.fn(),
  saveProductPromotion: vi.fn(),
  updateAdminProduct: vi.fn(),
  updateContactEnquiry: vi.fn(),
  updateOrderRequest: vi.fn(),
  uploadAdminBrochure: vi.fn(),
  uploadBrochurePage: vi.fn(),
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

  it("accepts and forwards a nested public category tree to the protected category workflow", async () => {
    service.saveAdminCategory.mockResolvedValueOnce(72);
    const category = {
      slug: "instrumenti",
      name: "Инструменти",
      description: "Професионални и хоби инструменти за всяка задача.",
      imageUrl: "/manus-storage/categories/tools.jpg",
      icon: "drill",
      subcategories: [{ label: "Електроинструменти", children: [{ label: "Бормашини" }] }, { label: "Ръчни инструменти", children: [{ label: "Бъркалки" }] }],
      sortOrder: 0,
      isActive: true,
    };
    const caller = appRouter.createCaller(adminContext());
    await expect(caller.admin.saveCategory({ id: 72, category })).resolves.toBe(72);
    expect(service.saveAdminCategory).toHaveBeenCalledWith(72, category, 17);
  });

  it("passes a validated order status and internal note to the protected workflow", async () => {
    service.updateOrderRequest.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(adminContext());
    await expect(caller.admin.updateOrder({ id: 9, status: "contacted", adminNote: "Customer contacted by phone." })).resolves.toBeUndefined();
    expect(service.updateOrderRequest).toHaveBeenCalledWith(9, "contacted", "Customer contacted by phone.", 17);
  });

  it("accepts a public contact enquiry only after validating the caller details and message", async () => {
    service.createContactEnquiry.mockResolvedValueOnce({ referenceNumber: "C-20260820-TEST1" });
    const caller = appRouter.createCaller({ ...adminContext(), user: null });
    const input = { fullName: "Contact customer", email: "contact@example.com", phone: "+359888111222", subject: "Информация за продукт", message: "Моля, изпратете информация за наличност и срок за доставка." };
    await expect(caller.contact.createEnquiry(input)).resolves.toEqual({ referenceNumber: "C-20260820-TEST1" });
    expect(service.createContactEnquiry).toHaveBeenCalledWith(input);
  });

  it("passes an authenticated administrator and bounded status update to the contact-enquiries workflow", async () => {
    service.updateContactEnquiry.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(adminContext());
    await expect(caller.admin.updateContactEnquiry({ id: 11, status: "contacted", adminNote: "Customer contacted by email." })).resolves.toBeUndefined();
    expect(service.updateContactEnquiry).toHaveBeenCalledWith(11, "contacted", "Customer contacted by email.", 17);
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

  it("passes a validated brochure PDF and its rendered pages to the authenticated administrator service", async () => {
    const sourcePdf = "data:application/pdf;base64,UEZERGF0YQ==";
    const pageData = "data:image/jpeg;base64,SlBFR0RhdGE=";
    service.uploadAdminBrochure.mockResolvedValueOnce({ id: 28, pageCount: 1 });
    const caller = appRouter.createCaller(adminContext());
    const input = { title: "September brochure", sourcePdf: { dataUrl: sourcePdf, fileName: "september.pdf" }, pages: [{ dataUrl: pageData, fileName: "page-01.jpg" }] };
    await expect(caller.admin.uploadBrochure(input)).resolves.toEqual({ id: 28, pageCount: 1 });
    expect(service.uploadAdminBrochure).toHaveBeenCalledWith(input, 17);
  });

  it("activates a brochure through the protected lifecycle procedure", async () => {
    service.activateAdminBrochure.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(adminContext());
    await expect(caller.admin.activateBrochure({ id: 28 })).resolves.toBeUndefined();
    expect(service.activateAdminBrochure).toHaveBeenCalledWith(28, 17);
  });

  it("replaces the active brochure through one protected upload-and-activation workflow", async () => {
    const sourcePdf = "data:application/pdf;base64,UEZERGF0YQ==";
    const pageData = "data:image/jpeg;base64,SlBFR0RhdGE=";
    const input = { title: "Replacement brochure", pageUrls: ["/manus-storage/brochures/page-01.jpg"] };
    service.replaceAdminBrochure.mockResolvedValueOnce({ id: 29, pageCount: 1 });
    const caller = appRouter.createCaller(adminContext());
    await expect(caller.admin.replaceBrochure(input)).resolves.toEqual({ id: 29, pageCount: 1 });
    expect(service.replaceAdminBrochure).toHaveBeenCalledWith(input, 17);
  });

  it("stores an individual rendered brochure page through the protected page-upload procedure", async () => {
    const input = { dataUrl: "data:image/jpeg;base64,SlBFR0RhdGE=", fileName: "page-01.jpg" };
    const stored = { key: "brochures/pages/page-01.jpg", url: "/manus-storage/brochures/pages/page-01.jpg" };
    service.uploadBrochurePage.mockResolvedValueOnce(stored);
    const caller = appRouter.createCaller(adminContext());
    await expect(caller.admin.uploadBrochurePage(input)).resolves.toEqual(stored);
    expect(service.uploadBrochurePage).toHaveBeenCalledWith(input, 17);
  });

  it("returns the active brochure through the public homepage procedure", async () => {
    const brochure = { id: 1, title: "Active brochure", pageUrls: ["/manus-storage/page.jpg"], pageCount: 1, sourcePdfUrl: "/manus-storage/brochure.pdf", isActive: true, isArchived: false, createdAt: new Date(), updatedAt: new Date(), isManaged: true };
    service.getPublicBrochure.mockResolvedValueOnce(brochure);
    const caller = appRouter.createCaller({ ...adminContext(), user: null });
    await expect(caller.catalogue.brochure()).resolves.toEqual(brochure);
  });
});

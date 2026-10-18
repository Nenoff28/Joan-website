import { describe, expect, it, vi, afterEach } from "vitest";
import { productPayloadSchema, productFieldErrors, readableProductError } from "../shared/productValidation";
import { productImageType, uploadProductImagesSequentially } from "../client/src/lib/productImageUpload";

const valid = {
  categoryId: 1, slug: "qa-product", name: "Тестов артикул", description: "Тестово описание на артикул",
  imageUrl: "/manus-storage/qa.png", gallery: ["/manus-storage/qa.png"], imageAlt: "Тестов артикул",
  priceEur: 12.5, oldPriceEur: null, availability: "on_request" as const, stockQuantity: 0,
  features: ["Височина — 190 см"], isActive: false,
};
afterEach(() => vi.unstubAllGlobals());
function mockFileReader() {
  vi.stubGlobal("FileReader", class {
    result: string | null = null;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    async readAsDataURL(file: File) {
      this.result = `data:${file.type || "application/octet-stream"};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
      this.onload?.();
    }
  });
}
const file = (name: string, type = "image/png") => new File([new Uint8Array([137,80,78,71,13,10,26,10])], name, { type });
describe("product form reliability", () => {
  it("accepts valid product data and the technical parameter/value contract", () => {
    expect(productPayloadSchema.parse(valid).features).toEqual(["Височина — 190 см"]);
  });
  it("reports a short description in Bulgarian before a network request", () => {
    const result = productPayloadSchema.safeParse({ ...valid, description: "  късо  " });
    expect(result.success).toBe(false);
    if (!result.success) expect(productFieldErrors(result.error.issues).description).toBe("Описанието трябва да съдържа поне 10 знака.");
  });
  it("hides old raw JSON Zod errors and handles invalid numeric input", () => {
    expect(readableProductError(new Error(JSON.stringify([{ path: ["description"], code: "too_small", message: "Too small: expected string to have >=10 characters" }])))).toBe("Описанието трябва да съдържа поне 10 знака.");
    const result = productPayloadSchema.safeParse({ ...valid, priceEur: Number.NaN });
    if (!result.success) expect(productFieldErrors(result.error.issues).priceEur).toBe("Проверете полето „Цена“.");
    expect(result.success).toBe(false);
  });
  it("supports files with an empty browser MIME type but rejects unsupported and oversized files", () => {
    expect(productImageType({name:"снимка.JPG", type:"", size:1})).toBe("image/jpeg");
    expect(() => productImageType({name:"image.heic", type:"image/heic", size:1})).toThrow("JPG, PNG или WEBP");
    expect(() => productImageType({name:"image.png", type:"image/png", size:10*1024*1024+1})).toThrow("10 MB");
  });
  it("uploads in sequence and publishes each successful image immediately", async () => {
    mockFileReader();
    const gallery: string[] = [];
    const progress: number[] = [];
    const upload = vi.fn(async () => {
      expect(gallery.length).toBe(upload.mock.calls.length - 1);
      return {url:`/manus-storage/${upload.mock.calls.length}.png`};
    });
    const count = await uploadProductImagesSequentially([file("one.png"), file("two.png")], 0, upload, image => gallery.push(image.url), current => progress.push(current));
    expect(count).toBe(2);
    expect(gallery).toHaveLength(2);
    expect(progress).toEqual([1,2]);
  });
  it("retains the first image when the second upload fails and allows a retry", async () => {
    mockFileReader();
    const gallery: string[] = [];
    const upload = vi.fn().mockResolvedValueOnce({url:"/manus-storage/one.png"}).mockRejectedValueOnce(new Error("Временна грешка"));
    await expect(uploadProductImagesSequentially([file("one.png"),file("two.png")],0,upload,image=>gallery.push(image.url),()=>{})).rejects.toThrow("Успешно качените 1 снимки са запазени");
    expect(gallery).toEqual(["/manus-storage/one.png"]);
    await uploadProductImagesSequentially([file("two.png")],1,async()=>({url:"/manus-storage/two.png"}),image=>gallery.push(image.url),()=>{});
    expect(gallery).toHaveLength(2);
  });
  it("enforces the TOTAL gallery limit instead of silently discarding uploads", async () => {
    const upload = vi.fn();
    await expect(uploadProductImagesSequentially([file("one.png"),file("two.png")],9,upload,()=>{},()=>{})).rejects.toThrow("най-много 10");
    expect(upload).not.toHaveBeenCalled();
  });
});

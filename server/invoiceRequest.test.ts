import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const checkout = readFileSync(resolve(process.cwd(), "client/src/pages/Checkout.tsx"), "utf8");
const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const service = readFileSync(resolve(process.cwd(), "server/catalogueService.ts"), "utf8");
const schema = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
const adminDetail = readFileSync(resolve(process.cwd(), "client/src/pages/AdminOrderDetail.tsx"), "utf8");
const adminCss = readFileSync(resolve(process.cwd(), "client/src/pages/adminOrderDetail.css"), "utf8");

describe("company invoice data in checkout requests", () => {
  it("offers explicit invoice/no-invoice choices and only renders company fields when requested", () => {
    expect(checkout).toContain("name=\"invoiceRequested\"");
    expect(checkout).toContain("Желая фактура за фирма");
    expect(checkout).toContain("Не желая фактура");
    expect(checkout).toContain("{values.invoiceRequested && (");
    expect(checkout).toContain("Име на фирмата *");
    expect(checkout).toContain("ЕИК/БУЛСТАТ *");
    expect(checkout).toContain("ИН по ЗДДС");
    expect(checkout).toContain("МОЛ *");
    expect(checkout).toContain("Населено място *");
    expect(checkout).toContain("Пощенски код *");
    expect(checkout).toContain("Адрес *");
    expect(checkout).toContain("Адрес допълнително");
    expect(checkout).toContain("Допълнителна информация");
  });

  it("validates requested invoice data on the client and server", () => {
    expect(checkout).toContain("if (values.invoiceRequested)");
    expect(checkout).toContain("next.invoiceCompanyName");
    expect(checkout).toContain("next.invoiceEik");
    expect(checkout).toContain("next.invoiceMol");
    expect(checkout).toContain("next.invoicePostcode");
    expect(router).toContain("invoiceRequested: z.boolean().default(false)");
    expect(checkout).toContain("/^(?:\\d{9}|\\d{13})$/");
    expect(checkout).toContain("maxLength={13}");
    expect(router).toContain("invoiceEik: z.string().trim().regex(/^(?:\\d{9}|\\d{13})$/");
    expect(router).toContain("superRefine((input, ctx)");
    expect(router).toContain("Invoice address is required");
  });

  it("persists invoice fields atomically while keeping old requests compatible", () => {
    expect(schema).toContain('invoiceRequested: boolean("invoiceRequested").default(false).notNull()');
    expect(schema).toContain('invoiceCompanyName: varchar("invoiceCompanyName", { length: 255 })');
    expect(schema).toContain('invoiceAdditionalInfo: text("invoiceAdditionalInfo")');
    expect(service).toContain("invoiceRequested: input.invoiceRequested ?? false");
    expect(service).toContain("invoiceCompanyName: input.invoiceRequested ? input.invoiceCompanyName?.trim() || null : null");
    expect(service).toContain("invoiceAdditionalInfo: input.invoiceRequested ? input.invoiceAdditionalInfo?.trim() || null : null");
    expect(adminDetail).toContain("invoiceRequested: boolean");
    expect(adminDetail).toContain("Желана фактура за фирма");
    expect(adminDetail).toContain("ЕИК/БУЛСТАТ");
    expect(adminDetail).toContain("ord-invoice-details");
    expect(adminCss).toContain(".ord-invoice-details");
  });
});

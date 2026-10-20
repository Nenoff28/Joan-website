import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("admin product entry workflow", () => {
  const adminSource = readFileSync(
    resolve(process.cwd(), "client/src/pages/Admin.tsx"),
    "utf8"
  );
  const routerSource = readFileSync(
    resolve(process.cwd(), "server/routers.ts"),
    "utf8"
  );
  const serviceSource = readFileSync(
    resolve(process.cwd(), "server/catalogueService.ts"),
    "utf8"
  );
  const validationSource = readFileSync(resolve(process.cwd(), "shared/productValidation.ts"), "utf8");
  const stylesheet = readFileSync(
    resolve(process.cwd(), "client/src/index.css"),
    "utf8"
  );

  it("uses the essential fields and category dropdown in the editor", () => {
    expect(adminSource).toContain("Име");
    expect(adminSource).toContain("Вътрешен код");
    expect(adminSource).toContain("Категория");
    expect(adminSource).toContain("<select");
    expect(adminSource).toContain("Цена EUR");
    expect(adminSource).toContain("Наличност");
    expect(adminSource).toContain("Описание");
  });

  it("supports a two-column technical data table with add/remove rows", () => {
    expect(adminSource).toContain("technicalRows: TechnicalRow[]");
    expect(adminSource).toContain('aria-label="Технически данни"');
    expect(adminSource).toContain("Параметър");
    expect(adminSource).toContain("Стойност");
    expect(adminSource).toContain("Добави ред");
    expect(adminSource).toContain("Премахни ред");
    expect(stylesheet).toContain(
      ".admin-technical-table-head, .admin-technical-row"
    );
  });

  it("accepts up to ten selected images and keeps a primary gallery image", () => {
    expect(adminSource).toContain("multiple");
    expect(adminSource).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(adminSource).toContain("files.length > 10");
    expect(adminSource).toContain("galleryUrls[0]");
    expect(adminSource).toContain("Снимките се качват наведнъж");
    expect(routerSource).toContain(
      "dataUrl: z.string().min(32).max(15_000_000)"
    );
    expect(serviceSource).toContain("bytes.length > 10 * 1024 * 1024");
  });

  it("serializes technical rows into the existing product features contract", () => {
    expect(adminSource).toContain(
      "`${row.label.trim()} — ${row.value.trim()}`"
    );
    expect(validationSource).toContain("features: z.array(");
    expect(validationSource).toContain('.max(180, "Всеки технически ред');
    expect(validationSource).toContain('.max(30, "Добавете най-много 30');
  });

  it("supports filtering, sorting and reversible bulk site visibility", () => {
    expect(adminSource).toContain("categoryFilter");
    expect(adminSource).toContain("availabilityFilter");
    expect(adminSource).toContain("productSort");
    expect(adminSource).toContain("Маркирай всички филтрирани артикули");
    expect(adminSource).toContain("Покажи в сайта");
    expect(adminSource).toContain("Скрий от сайта");
    expect(routerSource).toContain("setProductsActive");
    expect(serviceSource).toContain("export async function setAdminProductsActive");
    expect(serviceSource).toContain("product.published");
    expect(serviceSource).toContain("product.unpublished");
  });
});

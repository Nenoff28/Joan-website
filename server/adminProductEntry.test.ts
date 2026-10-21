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
    expect(adminSource).toContain("Качете до 10 снимки");
    expect(routerSource).toContain(
      "dataUrl: z.string().min(32).max(15_000_000)"
    );
    expect(serviceSource).toContain("bytes.length > 10 * 1024 * 1024");
  });

  it("supports replacing, promoting and reordering individual gallery images", () => {
    expect(adminSource).toContain("replaceGalleryImage");
    expect(adminSource).toContain("reorderGalleryImage");
    expect(adminSource).toContain("handleImageDrop");
    expect(adminSource).toContain("draggable={!Boolean(uploadProgress) && !saving}");
    expect(adminSource).toContain("dataTransfer.dropEffect = \"move\"");
    expect(adminSource).toContain("Смени");
    expect(adminSource).toContain("Основна");
    expect(adminSource).toContain("Премести снимка");
    expect(adminSource).toContain("imageUrl: nextGallery[0]");
    expect(stylesheet).toContain(".admin-gallery-actions");
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

  it("shows publication status between availability and quality", () => {
    expect(adminSource).toContain('label="В сайта"');
    expect(adminSource.indexOf('label="Наличност"')).toBeLessThan(adminSource.indexOf('label="В сайта"'));
    expect(adminSource.indexOf('label="В сайта"')).toBeLessThan(adminSource.indexOf('label="Качество"'));
    expect(adminSource).toContain('label: "Публикуван"');
    expect(adminSource).toContain('label: "Скрит"');
    expect(adminSource).toContain('label: "Премахнат"');
    expect(stylesheet).toContain(".admin-publication-status");
  });

  it("supports sorting by category, price, availability, publication and quality", () => {
    expect(adminSource).toContain('label="Категория"');
    expect(adminSource).toContain('label="Цена"');
    expect(adminSource).toContain('label="Наличност"');
    expect(adminSource).toContain('label="В сайта"');
    expect(adminSource).toContain('label="Качество"');
    expect(adminSource).toContain('"category-asc"');
    expect(adminSource).toContain('"price-desc"');
    expect(adminSource).toContain('"availability-asc"');
    expect(adminSource).toContain('"publication-desc"');
    expect(adminSource).toContain('"quality-asc"');
    expect(stylesheet).toContain(".admin-sort-header");
  });

  it("can isolate hidden products for bulk publication", () => {
    expect(adminSource).toContain('publicationFilter');
    expect(adminSource).toContain('<option value="hidden">Само скрити ({hiddenProductCount.toLocaleString("bg-BG")})</option>');
    expect(adminSource).toContain('(publicationFilter === "hidden" && !product.isActive && !product.isArchived)');
    expect(adminSource).toContain('setBulkVisibilityTarget(true)');
  });
});

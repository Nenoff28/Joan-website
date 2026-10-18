import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const editor = readFileSync(
  resolve(process.cwd(), "client/src/components/AdminCategoriesEditor.tsx"),
  "utf8"
);
const admin = readFileSync(
  resolve(process.cwd(), "client/src/pages/Admin.tsx"),
  "utf8"
);
const css = readFileSync(
  resolve(process.cwd(), "client/src/components/adminCategoriesEditor.css"),
  "utf8"
);
describe("category editor usability and access", () => {
  it("offers explicit main/child choices and internal parent selection", () => {
    expect(admin).toContain(
      "<AdminCategoriesEditor permissions={permissions} />"
    );
    expect(editor).toContain('aria-label="Тип категория"');
    expect(editor).toContain('value="main"');
    expect(editor).toContain('value="child"');
    expect(editor).toContain('aria-label="Категория родител"');
    expect(editor).toContain("blockedParents.has(row.id)");
    expect(editor).not.toContain("Подкатегории – по една на ред");
  });
  it("uses an actual file picker and category-write protected upload", () => {
    expect(editor).toContain("trpc.admin.uploadCategoryImage.useMutation");
    expect(editor).toContain("fileRef.current?.click()");
    expect(editor).toContain("readProductImage(file)");
    expect(editor).toContain("uploadBusy.current = true");
    expect(editor).toContain('hasPermission(permissions, "categories.write")');
  });
  it("validates before sending, keeps the draft on error and refreshes public/editor data", () => {
    expect(editor).toContain("categoryPayloadSchema.safeParse");
    expect(editor).toContain("categoryValidationMessage(failure)");
    expect(editor).toContain("utils.admin.productCategories.invalidate()");
    expect(editor).toContain("utils.catalogue.metadata.invalidate()");
    expect(editor).toContain("utils.catalogue.page.invalidate()");
    expect(editor).toContain(
      "setDraft(current => ({ ...current, id, automaticSlug: false }))"
    );
    expect(editor).toContain("Добави подкатегория");
    expect(editor).toContain("savedRow.publicUrl");
    expect(css).toContain("minmax(0, 1fr)");
    expect(css).toContain("max-width: 700px");
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const adminSource = readFileSync(resolve(process.cwd(), "client/src/pages/Admin.tsx"), "utf8");
const cssSource = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");

describe("bulk inventory editor UI contract", () => {
  it("uses absolute quantity inputs and a single save action", () => {
    expect(adminSource).toContain('type="number" min="0" max="999999"');
    expect(adminSource).toContain("trpc.admin.saveStockChanges.useMutation");
    expect(adminSource).toContain("Запиши промените");
    expect(adminSource).not.toContain("adjust.mutate({ id: product.id, delta: 1 })");
  });

  it("shows an explicit old-to-new review before saving", () => {
    expect(adminSource).toContain("Потвърждавате ли промените?");
    expect(adminSource).toContain("oldQuantity");
    expect(adminSource).toContain("newQuantity");
    expect(adminSource).toContain("Да, запиши промените");
    expect(cssSource).toContain(".admin-stock-confirmation");
  });

  it("keeps the batch endpoint behind inventory.write and bounds its payload", () => {
    expect(routerSource).toContain('saveStockChanges: permissionProcedure("inventory.write")');
    expect(routerSource).toContain(".max(100)");
    expect(routerSource).toContain("stockQuantity: z.number().int().min(0).max(999999)");
  });
});

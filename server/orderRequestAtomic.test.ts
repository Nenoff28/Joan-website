import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("atomic multi-item order request flow", () => {
  it("submits one items payload from checkout instead of parallel per-line mutations", () => {
    const checkout = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/Checkout.tsx"), "utf8");
    const router = fs.readFileSync(path.resolve(import.meta.dirname, "./routers.ts"), "utf8");
    const service = fs.readFileSync(path.resolve(import.meta.dirname, "./catalogueService.ts"), "utf8");
    expect(checkout).toContain("items: checkoutRows.map");
    expect(checkout).not.toContain("Promise.all(checkoutRows.map");
    expect(router).toContain("items: z.array");
    expect(service).toContain("db.transaction(async (tx)");
    expect(service).toContain("orderRequestItems");
  });

  it("keeps a single request number for the entire submitted cart", () => {
    const checkout = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/Checkout.tsx"), "utf8");
    expect(checkout).toContain("setRequestNumbers([result.requestNumber])");
    expect(checkout).not.toContain("results.map((result) => result.requestNumber)");
  });
});

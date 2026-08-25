import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("SSR public-route hydration", () => {
  it("keeps homepage, catalogue, product, and support routes eager in the client app", () => {
    const source = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/App.tsx"), "utf8");
    for (const route of ["Home", "Category", "Product", "About", "Contact", "Delivery", "Terms", "FAQ", "Returns"]) {
      expect(source).toMatch(new RegExp(`import ${route}`));
      expect(source).not.toContain(`const ${route} = lazy(`);
    }
  });
});

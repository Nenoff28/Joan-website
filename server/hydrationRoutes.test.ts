import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("SSR public-route hydration", () => {
  it("renders the same App component in the server and browser entries", () => {
    const serverEntry = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/entry-server.tsx"), "utf8");
    const clientEntry = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/entry-client.tsx"), "utf8");

    expect(serverEntry).toContain('import App from "./App"');
    expect(serverEntry).toContain("<App />");
    expect(serverEntry).not.toContain("SsrApp");
    expect(clientEntry).toContain("<App />");
    expect(fs.existsSync(path.resolve(import.meta.dirname, "../client/src/SsrApp.tsx"))).toBe(false);
  });

  it("keeps homepage, catalogue, product, and support routes eager in the client app", () => {
    const source = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/App.tsx"), "utf8");
    for (const route of ["Home", "Category", "Product", "About", "Contact", "Delivery", "Terms", "FAQ", "Returns"]) {
      expect(source).toMatch(new RegExp(`import ${route}`));
      expect(source).not.toContain(`const ${route} = lazy(`);
    }
  });
});

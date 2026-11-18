import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Node's ESM loader rejects absolute Windows paths (C:\...) in import(); a file:// URL works on every OS.
describe("production SSR entry import", () => {
  for (const file of ["server/_core/production.ts", "server/_core/vite.ts"]) {
    it(`${file} imports the SSR bundle through a file URL`, () => {
      const source = readFileSync(file, "utf8");
      expect(source).toContain("import(pathToFileURL(ssrEntryPath).href)");
      expect(source).not.toMatch(/import\(ssrEntryPath\)/);
    });
  }
});

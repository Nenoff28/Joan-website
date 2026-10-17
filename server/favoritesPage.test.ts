import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const favoritesSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Favorites.tsx"),
  "utf8"
);
const cssSource = readFileSync(
  resolve(process.cwd(), "client/src/index.css"),
  "utf8"
);

describe("favorites empty state refinements", () => {
  it("removes the LIST—00 label", () => {
    expect(favoritesSource).not.toContain("LIST—00");
  });

  it("keeps the gray panel solid without decorative square grid", () => {
    expect(cssSource).toContain(".favorites-empty-index");
    expect(cssSource).not.toContain(
      ".favorites-empty-index { background-image:"
    );
    expect(cssSource).not.toContain(
      "linear-gradient(rgba(255,255,255,.065) 1px, transparent 1px)"
    );
  });
});

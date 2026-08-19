import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const styleSource = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("3D brochure viewer", () => {
  it("keeps the page stage accessible through labelled carousel and numeric navigation controls", () => {
    expect(homeSource).toContain('aria-roledescription="carousel"');
    expect(homeSource).toContain('role="tablist"');
    expect(homeSource).toContain('aria-pressed={brochurePaused}');
    expect(homeSource).toContain('aria-label="Предишна страница"');
    expect(homeSource).toContain('aria-label="Следваща страница"');
  });

  it("limits optional sheet and gloss motion to browsers that do not prefer reduced motion", () => {
    expect(styleSource).toContain("@media (prefers-reduced-motion: no-preference)");
    expect(styleSource).toContain("brochure-sheet-enter");
    expect(styleSource).toContain("brochure-gloss");
  });
});

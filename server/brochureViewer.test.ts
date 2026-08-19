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

  it("provides fullscreen, touch swipe, keyboard navigation, and focus-return hooks", () => {
    expect(homeSource).toContain("requestFullscreen");
    expect(homeSource).toContain("exitFullscreen");
    expect(homeSource).toContain("onTouchStart={handleBrochureTouchStart}");
    expect(homeSource).toContain("onTouchEnd={handleBrochureTouchEnd}");
    expect(homeSource).toContain('event.key === "Escape"');
    expect(homeSource).toContain("fullscreenTriggerRef.current?.focus()");
  });

  it("uses a crop-focused side-preview treatment rather than contained page margins", () => {
    expect(styleSource).toContain(".brochure-page-preview { height: 302px; overflow: hidden; }");
    expect(styleSource).toContain(".brochure-page-preview img { height: 332px; object-fit: cover");
    expect(styleSource).toContain(".brochure-viewer-shell:fullscreen");
  });
});

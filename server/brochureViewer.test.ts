import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const styleSource = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("3D brochure viewer", () => {
  it("keeps the page stage accessible through labelled carousel and numeric navigation controls", () => {
    expect(homeSource).toContain('aria-roledescription="carousel"');
    expect(homeSource).toContain('role="tablist"');
    expect(homeSource).toContain('aria-label={en ? "Previous page" : "Предишна страница"}');
    expect(homeSource).toContain('aria-label={en ? "Next page" : "Следваща страница"}');
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

  it("keeps adjacent page previews complete while avoiding decorative white frames", () => {
    expect(styleSource).toContain(".brochure-page-preview { height: 266px; overflow: visible; }");
    expect(styleSource).toContain(".brochure-page-preview img { aspect-ratio: 210 / 297; background: transparent");
    expect(styleSource).toContain(".brochure-viewer-shell:fullscreen");
  });

  it("uses the native brochure-page ratio without cropping central printed content", () => {
    expect(styleSource).toContain(".brochure-page-frame { aspect-ratio: 1011 / 1418; background: transparent; }");
    expect(styleSource).toContain(".brochure-page-frame img { height: auto; object-fit: contain; width: 100%; }");
    expect(styleSource).toContain(".brochure-viewer-shell:fullscreen .brochure-page-frame img { height: auto; object-fit: contain; width: 100%; }");
    expect(styleSource).not.toContain(".brochure-page-frame img { height: 542px; object-fit: cover;");
  });

  it("keeps the requested monthly brochure heading without broad inline type overrides", () => {
    expect(homeSource).toContain('"Browse the offers in the monthly brochure."');
    expect(homeSource).toContain('"Разгледайте офертите от месечната брошура."');
    expect(homeSource).not.toContain("style={{fontSize: '20px'}}");
    expect(homeSource).toContain('Browse<br />offers');
    expect(homeSource).toContain('Разгледайте<br />офертите');
    expect(homeSource).toContain("Строителни материали");
    expect(homeSource).not.toContain("style={{fontSize: '55px'}}");
    expect(styleSource).toContain(".brochure-heading-meta b { font-size: .9375rem;");
    expect(styleSource).toContain('.hero-content h1::before { content: "Строителни материали"; }');
    expect(styleSource).toContain('.hero-content h1::after { color: #f2c9c8; content: "и инструменти"; }');
  });

  it("advances every seven seconds without presenting a pause control", () => {
    expect(homeSource).toContain("), 7000)");
    expect(homeSource).not.toContain("brochurePaused");
    expect(homeSource).not.toContain("brochure-play-toggle");
  });
});

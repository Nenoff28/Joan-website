import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

const stylesheet = postcss.parse(
  readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8")
);
const home = readFileSync(
  resolve(process.cwd(), "client/src/pages/Home.tsx"),
  "utf8"
);

function declaration(selector: string, property: string) {
  let value = "";
  stylesheet.walkRules(rule => {
    if (rule.selectors.includes(selector)) {
      rule.walkDecls(property, decl => {
        value = decl.value;
      });
    }
  });
  return value;
}

function luminance(hex: string) {
  const components = hex
    .replace("#", "")
    .match(/../g)!
    .map(part => parseInt(part, 16) / 255);
  const linear = components.map(component =>
    component <= 0.04045
      ? component / 12.92
      : ((component + 0.055) / 1.055) ** 2.4
  );
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("calm homepage entrance palette", () => {
  it("replaces the large red navigation panel with a warm neutral surface", () => {
    expect(
      declaration(".homepage-entrance .homepage-category-menu", "background")
    ).toBe("var(--home-menu-surface)");
    expect(declaration(".homepage-entrance", "--home-menu-surface")).toBe(
      "#f7f5f2"
    );
    expect(home).not.toContain("backgroundColor: '#d23a32'");
    expect(
      declaration(".homepage-entrance .homepage-category-menu", "border-top")
    ).toBe("2px solid var(--home-menu-accent)");
  });

  it("uses a graphite brochure button with white text and a non-red hover", () => {
    const button = ".homepage-entrance .homepage-entrance-cta-primary";
    expect(declaration(button, "background")).toBe("var(--home-cta-surface)");
    expect(declaration(button, "color")).toBe("#fff");
    expect(declaration(`${button}:hover`, "background")).toBe(
      "var(--home-cta-hover)"
    );
    expect(home).toContain('href="#brochure"');
  });

  it("preserves AA text contrast on the new surfaces", () => {
    const surface = declaration(".homepage-entrance", "--home-menu-surface");
    for (const token of [
      "--home-menu-ink",
      "--home-menu-muted",
      "--home-menu-accent",
    ]) {
      expect(
        contrast(declaration(".homepage-entrance", token), surface)
      ).toBeGreaterThanOrEqual(4.5);
    }
    expect(
      contrast(
        "#ffffff",
        declaration(".homepage-entrance", "--home-cta-surface")
      )
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps click-only opening and visible keyboard focus", () => {
    expect(home).toContain(
      "aria-expanded={openCategorySlug === category.slug}"
    );
    expect(
      declaration(
        ".homepage-category-menu .homepage-category-item > .homepage-category-link:focus-visible",
        "outline"
      )
    ).toBe("2px solid var(--home-menu-accent)");
    expect(
      declaration(
        ".homepage-entrance .homepage-entrance-cta-primary:focus-visible",
        "outline"
      )
    ).toBe("2px solid var(--home-menu-accent)");
    expect(home).toContain('href="#current-offers"');
  });
});

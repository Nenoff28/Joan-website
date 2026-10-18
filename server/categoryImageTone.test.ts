import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";
import { categories } from "../client/src/lib/storeData";

const stylesheet = postcss.parse(
  readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8")
);
const replacementSlugs = [
  "instrumenti",
  "banya",
  "v-i-k",
  "boi-lakove-mazilki",
  "rabotno-obleklo",
];

function matchingFilterSelectors(value: string) {
  const selectors: string[] = [];
  stylesheet.walkRules(rule => {
    rule.walkDecls("filter", declaration => {
      if (declaration.value === value && declaration.important) {
        selectors.push(...rule.selectors);
      }
    });
  });
  return selectors;
}

describe("natural category photography and readable captions", () => {
  it("uses distinct calm assets for home and construction without replacing other categories", () => {
    const images = Object.fromEntries(
      categories.map(category => [category.slug, category.image])
    );
    expect(images["za-doma"]).toBe(
      "/manus-storage/joan-home-calm-20261018_cf212abf.jpg"
    );
    expect(images.stroitelstvo).toBe(
      "/manus-storage/joan-construction-calm-20261018_4d80e6ca.jpg"
    );
    expect(images).toMatchObject({
      instrumenti: "/manus-storage/joan-tools-natural-20261017_514b8fe3.jpg",
      gradina: "/manus-storage/joan-garden-materials_4dda013b.jpg",
      banya: "/manus-storage/joan-bathroom-natural-20261017_e0d5874f.jpg",
      osvetlenie: "/manus-storage/joan-lighting-electrical_530229da.jpg",
      "podovi-i-stenni-pokritiya":
        "/manus-storage/joan-floor-wall-surfaces_a5ee519f.jpg",
      "v-i-k": "/manus-storage/joan-plumbing-natural-20261017_46488f92.jpg",
      "vrati-obkov-krepezhi":
        "/manus-storage/joan-doors-fittings-fasteners_7b8c2d09.jpg",
      "boi-lakove-mazilki":
        "/manus-storage/joan-paints-natural-20261017_4567cf1a.jpg",
      "rabotno-obleklo":
        "/manus-storage/joan-workwear-natural-20261017_f45a7361.jpg",
    });
  });

  it("disables vivid-photo boosting only for the seven replacement photographs", () => {
    expect(matchingFilterSelectors("none").sort()).toEqual(
      [...replacementSlugs, "za-doma", "stroitelstvo"]
        .map(slug => `a.feature-category-card[href="/category/${slug}"] img`)
        .sort()
    );
  });

  it("keeps the garden and the other approved photos at their previous treatment", () => {
    expect(
      matchingFilterSelectors("saturate(.8) brightness(1.42) contrast(1.02)")
    ).toContain('a.feature-category-card[href="/category/gradina"] img');
    expect(
      matchingFilterSelectors("saturate(1.95) brightness(1.42) contrast(1.02)")
    ).toContain(".feature-category-card img");
  });

  it("provides five distinct managed image assets in the static fallback", () => {
    const images = categories
      .filter(category => replacementSlugs.includes(category.slug))
      .map(category => category.image);
    expect(images).toHaveLength(5);
    expect(new Set(images).size).toBe(5);
    for (const image of images) {
      expect(image).toMatch(
        /^\/manus-storage\/joan-[a-z]+-natural-20261017_[a-f0-9]+\.jpg$/
      );
    }
  });

  it("wraps every category title and description in a contrasting caption panel", () => {
    const home = readFileSync(
      resolve(process.cwd(), "client/src/pages/Home.tsx"),
      "utf8"
    );
    expect(home).toMatch(
      /className="feature-category-copy">\s*<p>\{category.label\}<\/p>\s*<small>\{category.description\}<\/small>/
    );
    let background = "";
    let textColour = "";
    stylesheet.walkRules(rule => {
      if (rule.selector === ".feature-category-card .feature-category-copy") {
        rule.walkDecls("background", declaration => {
          background = declaration.value;
        });
      }
      if (
        rule.selectors.includes(
          ".feature-category-card .feature-category-copy p"
        )
      ) {
        rule.walkDecls("color", declaration => {
          textColour = declaration.value;
        });
      }
    });
    expect(background).toBe("rgba(24, 30, 33, .82)");
    expect(textColour).toBe("#fff");
  });
});

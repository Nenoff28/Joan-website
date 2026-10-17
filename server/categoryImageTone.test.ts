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
  it("disables vivid-photo boosting only for the five replacement photographs", () => {
    expect(matchingFilterSelectors("none").sort()).toEqual(
      replacementSlugs
        .map(slug => `a.feature-category-card[href="/category/${slug}"] img`)
        .sort()
    );
  });

  it("keeps the garden and the five approved photos at their previous treatment", () => {
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

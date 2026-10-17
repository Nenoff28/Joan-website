import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

const stylesheet = postcss.parse(
  readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8")
);
const changedSlugs = [
  "instrumenti",
  "gradina",
  "banya",
  "v-i-k",
  "boi-lakove-mazilki",
  "rabotno-obleklo",
];
const approvedSlugs = [
  "za-doma",
  "osvetlenie",
  "podovi-i-stenni-pokritiya",
  "vrati-obkov-krepezhi",
  "stroitelstvo",
];

describe("selective category photo colour refinement", () => {
  it("softens only the six vivid category photos without dimming them", () => {
    const selectors: string[] = [];
    stylesheet.walkRules(rule => {
      rule.walkDecls("filter", declaration => {
        if (
          declaration.value === "saturate(.8) brightness(1.42) contrast(1.02)"
        ) {
          expect(declaration.important).toBe(true);
          selectors.push(...rule.selectors);
        }
      });
    });
    expect(selectors.sort()).toEqual(
      changedSlugs
        .map(slug => `a.feature-category-card[href="/category/${slug}"] img`)
        .sort()
    );
    for (const slug of approvedSlugs) {
      expect(
        selectors.some(selector => selector.includes(`/category/${slug}`))
      ).toBe(false);
    }
  });

  it("retains the existing treatment for the five approved photos", () => {
    const values: string[] = [];
    stylesheet.walkRules(rule => {
      if (rule.selectors.includes(".feature-category-card img")) {
        rule.walkDecls("filter", declaration => {
          if (declaration.important) values.push(declaration.value);
        });
      }
    });
    expect(values).toEqual(["saturate(1.95) brightness(1.42) contrast(1.02)"]);
  });
});

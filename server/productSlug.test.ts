import { describe, expect, it } from "vitest";
import { legacyProductSlug, preferredProductSlug, toLatinSlug, uniqueProductSlug } from "../scripts/lib/product-slug.mjs";

describe("product SEO slug utilities", () => {
  it("transliterates Bulgarian names into Latin-only canonical slugs", () => {
    expect(toLatinSlug("Мрежа Оградна поцинкована")).toBe("mrezha-ogradna-potsinkovana");
    expect(preferredProductSlug({ legacySeoKeywordBg: "", name: "Ръкавици Bi-Colour", legacyProductId: 24 })).toBe("rakavitsi-bi-colour");
  });

  it("keeps canonical slugs unique without introducing a legacy prefix", () => {
    const usedSlugs = new Set(["rakavitsi-bi-colour"]);
    expect(uniqueProductSlug("rakavitsi-bi-colour", 24, usedSlugs)).toBe("rakavitsi-bi-colour-24");
    expect(uniqueProductSlug("rakavitsi-bi-colour", 24, usedSlugs)).toBe("rakavitsi-bi-colour-24-2");
  });

  it("preserves a distinct old route value for redirect compatibility", () => {
    expect(legacyProductSlug("Мрежа Оградна поцинкована", 2432)).toBe("legacy-2432-mrezha-ogradna-potsinkovana");
  });
});

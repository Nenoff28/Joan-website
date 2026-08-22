import { describe, expect, it } from "vitest";
import { normalizeCartLines } from "../client/src/contexts/CartContext";
import { normalizeFavoriteSlugs } from "../client/src/contexts/FavoritesContext";

describe("persistent product slug migration", () => {
  const migration = [{ from: "legacy-2432-record", to: "mrezha-ogradna-potsinkovana" }];

  it("converts old cart lines and merges duplicate quantities safely", () => {
    expect(normalizeCartLines([
      { slug: "legacy-2432-record", quantity: 2 },
      { slug: "mrezha-ogradna-potsinkovana", quantity: 3 },
    ], migration)).toEqual([{ slug: "mrezha-ogradna-potsinkovana", quantity: 5 }]);
  });

  it("converts a saved favorite without duplicating an already canonical entry", () => {
    expect(Array.from(normalizeFavoriteSlugs(new Set(["legacy-2432-record", "mrezha-ogradna-potsinkovana"]), migration))).toEqual(["mrezha-ogradna-potsinkovana"]);
  });
});

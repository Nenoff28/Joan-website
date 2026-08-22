import { describe, expect, it } from "vitest";
import { descendantCategoryIds } from "./catalogueService";

describe("intermediate catalogue category browseability", () => {
  it("includes the selected legacy category and every nested descendant", () => {
    const rows = [
      { id: 10, legacyCategoryId: 100, legacyParentCategoryId: 91 },
      { id: 11, legacyCategoryId: 101, legacyParentCategoryId: 100 },
      { id: 12, legacyCategoryId: 102, legacyParentCategoryId: 101 },
      { id: 13, legacyCategoryId: 103, legacyParentCategoryId: 99 },
    ];
    expect(descendantCategoryIds(rows, [10]).sort((left, right) => left - right)).toEqual([10, 11, 12]);
  });
});

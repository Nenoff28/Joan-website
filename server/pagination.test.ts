import { describe, expect, it } from "vitest";
import { paginationItems } from "../client/src/lib/pagination";

describe("catalogue page-range navigation", () => {
  it("provides first, current neighbourhood, last page, and ellipses for distant pages", () => {
    expect(paginationItems(147, 147)).toEqual([1, 2, "ellipsis", 146, 147]);
    expect(paginationItems(147, 74)).toEqual([1, 2, "ellipsis", 73, 74, 75, "ellipsis", 146, 147]);
  });

  it("shows every page when the result set is short", () => {
    expect(paginationItems(5, 3)).toEqual([1, 2, 3, 4, 5]);
  });
});

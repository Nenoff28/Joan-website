import { describe, expect, it } from "vitest";
import { parseQuickOrder } from "../client/src/lib/quickOrder";

describe("parseQuickOrder", () => {
  it("reads codes with the quantity notations tradespeople type", () => {
    expect(parseQuickOrder("12829\n118903 x10\n114894 х 3\n110250*2\n104735 5\n121468;4")).toEqual([
      { code: "12829", quantity: 1 },
      { code: "118903", quantity: 10 },
      { code: "114894", quantity: 3 },
      { code: "110250", quantity: 2 },
      { code: "104735", quantity: 5 },
      { code: "121468", quantity: 4 },
    ]);
  });

  it("skips blank or unreadable lines and merges repeated codes", () => {
    expect(parseQuickOrder("\n  12829 x2 \nтова не е код\n12829\n\n")).toEqual([{ code: "12829", quantity: 3 }]);
  });

  it("keeps codes that contain the letter x", () => {
    expect(parseQuickOrder("XP200\nXP200 x 2\nAPZ10-650M")).toEqual([
      { code: "XP200", quantity: 3 },
      { code: "APZ10-650M", quantity: 1 },
    ]);
  });

  it("keeps quantities within 1..9999", () => {
    expect(parseQuickOrder("12829 x0")).toEqual([{ code: "12829", quantity: 1 }]);
  });
});

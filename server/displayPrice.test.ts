import { describe, expect, it } from "vitest";
import { displayPrice } from "../client/src/lib/price";

describe("displayPrice", () => {
  it("shows euro prices in the Bulgarian format", () => {
    expect(displayPrice("2.71€")).toBe("2,71 €");
    expect(displayPrice("1234.50€")).toBe("1234,50 €");
    expect(displayPrice("0.00€")).toBe("0,00 €");
  });

  it("leaves missing or unexpected values unchanged", () => {
    expect(displayPrice(undefined)).toBeUndefined();
    expect(displayPrice(null)).toBeUndefined();
    expect(displayPrice("По запитване")).toBe("По запитване");
  });
});

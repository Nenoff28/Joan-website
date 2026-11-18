import { describe, expect, it } from "vitest";
import { brandKeys } from "../shared/brandKeys";

const matches = (productBrand: string, manufacturer: string) => brandKeys(productBrand).some((key) => brandKeys(manufacturer).includes(key));

// Real pairs from the production snapshot where product.brand and catalogue_manufacturers.name differ.
describe("brand name matching for manufacturer logos", () => {
  it.each([
    ["ROCA", "Roca"],
    ["VIDIMA", "Vidima"],
    ["PREMIUM", "Premium"],
    ["VIVA LUX", "Vivalux"],
    ["Kärcher", "KARCHER"],
    ["Д-р ФРЕШ", "Dr Fresh"],
    ["ТОРЕХ", "Topex"],
  ])("matches %s to %s", (productBrand, manufacturer) => {
    expect(matches(productBrand, manufacturer)).toBe(true);
  });

  it.each([
    ["Марсел", "Mefisto"],
    ["Bosch", "Roca"],
    ["", "Roca"],
  ])("does not match %s to %s", (productBrand, manufacturer) => {
    expect(matches(productBrand, manufacturer)).toBe(false);
  });
});

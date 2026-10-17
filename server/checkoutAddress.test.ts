import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { bulgarianLocations } from "../client/src/lib/bulgarianLocations";

const checkoutSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Checkout.tsx"),
  "utf8"
);
const cssSource = readFileSync(
  resolve(process.cwd(), "client/src/index.css"),
  "utf8"
);
const schemaSource = readFileSync(
  resolve(process.cwd(), "drizzle/schema.ts"),
  "utf8"
);
const serviceSource = readFileSync(
  resolve(process.cwd(), "server/catalogueService.ts"),
  "utf8"
);

describe("checkout address selection", () => {
  it("ships a complete local Bulgarian settlement reference", () => {
    expect(bulgarianLocations).toHaveLength(5351);
    expect(
      new Set(bulgarianLocations.map(location => location.region))
    ).toHaveLength(28);
    expect(
      bulgarianLocations.some(
        location =>
          location.region === "Силистра" &&
          location.name === "Силистра" &&
          location.postcode === "7500"
      )
    ).toBe(true);
    expect(
      bulgarianLocations.some(
        location => location.region === "Силистра" && location.type === "с."
      )
    ).toBe(true);
  });

  it("uses searchable region and dependent city/village comboboxes with editable postcode", () => {
    expect(checkoutSource).toContain("const regions = useMemo");
    expect(checkoutSource).toContain("const locationOptions = useMemo");
    expect(checkoutSource).toContain("filteredRegions");
    expect(checkoutSource).toContain("filteredLocations");
    expect(checkoutSource).toContain("startsWith(query)");
    expect(checkoutSource).toContain('role="combobox"');
    expect(checkoutSource).toContain('aria-autocomplete="list"');
    expect(checkoutSource).toContain("updateRegion(region)");
    expect(checkoutSource).toContain("updateLocation(");
    expect(checkoutSource).toContain("${location.name}::${location.postcode}");
    expect(checkoutSource).not.toContain('<option value="">');
    expect(checkoutSource).not.toContain("readOnly");
    expect(checkoutSource).toContain("Въведете или редактирайте кода");
    expect(checkoutSource).toContain("Enter or edit the postcode");
    expect(cssSource).toContain(".checkout-combobox");
    expect(cssSource).toContain(".checkout-suggestions");
  });

  it("accepts digits only in the phone field and removes checkout step numbers", () => {
    expect(checkoutSource).toContain('inputMode="numeric"');
    expect(checkoutSource).toContain('pattern="[0-9]*"');
    expect(checkoutSource).toContain('event.target.value.replace(/\\D/g, "")');
    expect(cssSource).not.toContain("request-stage");
    expect(cssSource).not.toContain("checkout-form-panel legend::after");
  });

  it("persists the selected region with the atomic order request", () => {
    expect(checkoutSource).toContain("region: values.region.trim()");
    expect(schemaSource).toContain(
      'region: varchar("region", { length: 160 })'
    );
    expect(serviceSource).toContain("region?: string");
    expect(serviceSource).toContain("region: input.region ?? null");
  });
});

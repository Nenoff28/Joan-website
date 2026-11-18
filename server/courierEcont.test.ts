import { describe, expect, it } from "vitest";
import { econtOfficesFromResponse, econtPriceFromResponse } from "./couriers/econt";

// Shape taken from a real getOffices response (office 7502, Силистра Аврора).
const silistra = {
  id: 360,
  code: "7502",
  name: "Силистра Аврора",
  isAPS: false,
  normalBusinessHoursFrom: 1794985200000,
  normalBusinessHoursTo: 1795017600000,
  address: { fullAddress: " Силистра ул. София №80 срещу входа на Камъшит", city: { name: "Силистра", postCode: "7500" }, location: { latitude: 44.11150493565812, longitude: 27.261157602841752 } },
};

describe("econtOfficesFromResponse", () => {
  it("maps Econt offices to the shared office shape", () => {
    expect(econtOfficesFromResponse({ offices: [silistra] })).toEqual([
      { courier: "econt", code: "7502", name: "Силистра Аврора", city: "Силистра", postcode: "7500", address: "Силистра ул. София №80 срещу входа на Камъшит", lat: 44.11150493565812, lng: 27.261157602841752, hours: "09:00–18:00", isLocker: false },
    ]);
  });

  it("keeps offices without coordinates and marks lockers", () => {
    const [office] = econtOfficesFromResponse({ offices: [{ ...silistra, isAPS: true, normalBusinessHoursFrom: null, address: { ...silistra.address, location: null } }] });
    expect(office).toMatchObject({ lat: null, lng: null, isLocker: true, hours: "" });
  });

  it("returns no offices for an unexpected response", () => {
    expect(econtOfficesFromResponse(null)).toEqual([]);
    expect(econtOfficesFromResponse({ offices: "x" })).toEqual([]);
  });
});

describe("econtPriceFromResponse", () => {
  it("reads the calculated total", () => {
    expect(econtPriceFromResponse({ label: { totalPrice: 6.7, currency: "EUR" } })).toBe(6.7);
  });

  it("returns null when there is no usable price", () => {
    expect(econtPriceFromResponse({})).toBeNull();
    expect(econtPriceFromResponse({ label: { totalPrice: "x" } })).toBeNull();
    expect(econtPriceFromResponse({ label: { totalPrice: 5, currency: "BGN" } })).toBeNull();
  });
});

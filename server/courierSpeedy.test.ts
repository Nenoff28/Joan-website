import { describe, expect, it } from "vitest";
import { speedyOfficesFromResponse, speedyPriceFromResponse } from "./couriers/speedy";

// Field names from the Speedy Web API docs (Office, Address); confirm against a real response once credentials exist.
const locker = {
  id: 77,
  name: "СИЛИСТРА - АВТОМАТ ЦЕНТЪР",
  type: "APT",
  address: { fullAddressString: "гр. Силистра, ул. Добруджа 1", siteName: "СИЛИСТРА", postCode: "7500", x: 27.26, y: 44.11 },
  workingTimeFrom: "09:00",
  workingTimeTo: "18:00",
};

describe("speedyOfficesFromResponse", () => {
  it("maps Speedy offices to the shared office shape", () => {
    expect(speedyOfficesFromResponse({ offices: [locker] })).toEqual([
      { courier: "speedy", code: "77", name: "СИЛИСТРА - АВТОМАТ ЦЕНТЪР", city: "СИЛИСТРА", postcode: "7500", address: "гр. Силистра, ул. Добруджа 1", lat: 44.11, lng: 27.26, hours: "09:00–18:00", isLocker: true },
    ]);
  });

  it("keeps offices without coordinates", () => {
    const [office] = speedyOfficesFromResponse({ offices: [{ ...locker, type: "OFFICE", address: { ...locker.address, x: undefined, y: undefined } }] });
    expect(office).toMatchObject({ lat: null, lng: null, isLocker: false });
  });

  it("returns no offices for an error response", () => {
    expect(speedyOfficesFromResponse({ error: { message: "Invalid credentials" } })).toEqual([]);
  });
});

describe("speedyPriceFromResponse", () => {
  it("reads the total for service 505", () => {
    expect(speedyPriceFromResponse({ calculations: [{ serviceId: 505, price: { total: 6.1, currency: "EUR" } }] })).toBe(6.1);
  });

  it("returns null for errors or other currencies", () => {
    expect(speedyPriceFromResponse({ calculations: [{ serviceId: 505, error: { message: "x" } }] })).toBeNull();
    expect(speedyPriceFromResponse({ calculations: [{ serviceId: 505, price: { total: 9, currency: "BGN" } }] })).toBeNull();
    expect(speedyPriceFromResponse({ error: { message: "x" } })).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { courierOfficeAddress } from "../client/src/lib/courierAddress";
import type { CourierOffice } from "./couriers/types";

const econt: CourierOffice = { courier: "econt", code: "7502", name: "Силистра Аврора", city: "Силистра", postcode: "7500", address: "Силистра ул. София №80", lat: 44.1, lng: 27.2, hours: "09:00–18:00", isLocker: false };

describe("courierOfficeAddress", () => {
  it("records the office and the estimated price in the request address", () => {
    expect(courierOfficeAddress(econt, 6.7)).toEqual({
      address: "Офис Еконт: Силистра Аврора (7502) — Силистра ул. София №80; ориентировъчна доставка 6,70 €",
      region: "Силистра",
      city: "Силистра",
      postcode: "7500",
    });
  });

  it("says the operator confirms the price when there is none", () => {
    expect(courierOfficeAddress(econt, null).address).toBe("Офис Еконт: Силистра Аврора (7502) — Силистра ул. София №80; цена за доставка: потвърждава се от оператор");
  });

  it("names Speedy lockers as lockers", () => {
    const locker = { ...econt, courier: "speedy" as const, code: "77", name: "Автомат Център", isLocker: true };
    expect(courierOfficeAddress(locker, 3.5).address).toBe("Автомат Спиди: Автомат Център (77) — Силистра ул. София №80; ориентировъчна доставка 3,50 €");
  });

  it("keeps the request valid when the office has no postcode", () => {
    expect(courierOfficeAddress({ ...econt, postcode: "" }, 6.7).postcode).toBe("0000");
  });
});

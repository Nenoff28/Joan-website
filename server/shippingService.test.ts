import { describe, expect, it, vi } from "vitest";
import { createShippingService, shippingAdaptersFromEnv, visitorAddress } from "./couriers/shippingService";
import type { CourierOffice } from "./couriers/types";

const office = (courier: "econt" | "speedy", code: string): CourierOffice => ({ courier, code, name: code, city: "Силистра", postcode: "7500", address: "", lat: 44.1, lng: 27.2, hours: "", isLocker: false });

function adapter(offices: CourierOffice[], price: number | null = 6.7) {
  return { listOffices: vi.fn(async () => offices), quote: vi.fn(async () => price) };
}

describe("shipping service", () => {
  it("lists offices only for configured couriers and caches them for a day", async () => {
    let now = 0;
    const econt = adapter([office("econt", "7502")]);
    const service = createShippingService({ econt }, { weightKg: 2, now: () => now });
    expect(await service.offices()).toEqual([office("econt", "7502")]);
    now += 23 * 3600_000;
    await service.offices();
    expect(econt.listOffices).toHaveBeenCalledTimes(1);
    now += 2 * 3600_000;
    await service.offices();
    expect(econt.listOffices).toHaveBeenCalledTimes(2);
  });

  it("keeps the other courier when one courier fails", async () => {
    const econt = { listOffices: vi.fn(async () => { throw new Error("down"); }), quote: vi.fn() };
    const speedy = adapter([office("speedy", "77")]);
    const service = createShippingService({ econt, speedy }, { weightKg: 2 });
    expect(await service.offices()).toEqual([office("speedy", "77")]);
  });

  it("quotes with the default weight and caches the price per office", async () => {
    const econt = adapter([], 6.7);
    const service = createShippingService({ econt }, { weightKg: 2 });
    expect(await service.quote("econt", "7502", "1.1.1.1")).toEqual({ priceEur: 6.7 });
    expect(await service.quote("econt", "7502", "1.1.1.1")).toEqual({ priceEur: 6.7 });
    expect(econt.quote).toHaveBeenCalledTimes(1);
    expect(econt.quote).toHaveBeenCalledWith("7502", 2);
  });

  it("returns no price when the courier fails or is not configured", async () => {
    const econt = { listOffices: vi.fn(), quote: vi.fn(async () => { throw new Error("timeout"); }) };
    const service = createShippingService({ econt }, { weightKg: 2 });
    expect(await service.quote("econt", "7502", "1.1.1.1")).toEqual({ priceEur: null });
    expect(await service.quote("speedy", "77", "1.1.1.1")).toEqual({ priceEur: null });
  });

  it("limits one visitor to 30 price requests a minute", async () => {
    const service = createShippingService({ econt: adapter([]) }, { weightKg: 2 });
    for (let i = 0; i < 30; i += 1) await service.quote("econt", `c${i}`, "2.2.2.2");
    await expect(service.quote("econt", "c31", "2.2.2.2")).rejects.toThrow("Твърде много заявки за цена. Опитайте след минута.");
    await expect(service.quote("econt", "c31", "3.3.3.3")).resolves.toEqual({ priceEur: 6.7 });
  });
});

describe("shippingAdaptersFromEnv", () => {
  it("configures only couriers with a username and password", () => {
    expect(Object.keys(shippingAdaptersFromEnv({ ECONT_API_URL: "https://ee.econt.com/services", ECONT_USERNAME: "u", ECONT_PASSWORD: "p" }))).toEqual(["econt"]);
    expect(Object.keys(shippingAdaptersFromEnv({ SPEEDY_USERNAME: "968304", SPEEDY_PASSWORD: "" }))).toEqual([]);
  });
});

describe("visitorAddress", () => {
  it("uses the first forwarded address so visitors behind the hosting proxy are limited separately", () => {
    expect(visitorAddress({ headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" }, ip: "10.0.0.1" })).toBe("203.0.113.7");
    expect(visitorAddress({ headers: { "x-forwarded-for": ["198.51.100.2"] }, ip: "10.0.0.1" })).toBe("198.51.100.2");
  });

  it("falls back to the socket address", () => {
    expect(visitorAddress({ headers: {}, ip: "127.0.0.1" })).toBe("127.0.0.1");
    expect(visitorAddress({ headers: {}, socket: { remoteAddress: "::1" } })).toBe("::1");
    expect(visitorAddress({ headers: {} })).toBe("unknown");
  });
});

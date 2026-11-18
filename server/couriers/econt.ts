import { COURIER_TIMEOUT_MS, finiteNumber, text, type CourierOffice } from "./types";

export type EcontConfig = { url: string; username: string; password: string };

const sofiaTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Sofia" });

// Econt sends opening hours as epoch milliseconds of today's date; only the Sofia wall-clock time matters.
function hoursRange(from: unknown, to: unknown) {
  const start = finiteNumber(from);
  const end = finiteNumber(to);
  return start !== null && end !== null ? `${sofiaTime.format(start)}–${sofiaTime.format(end)}` : "";
}

export function econtOfficesFromResponse(json: unknown): CourierOffice[] {
  const offices = (json as { offices?: unknown } | null)?.offices;
  if (!Array.isArray(offices)) return [];
  return offices.flatMap((raw): CourierOffice[] => {
    const office = raw as Record<string, any>;
    const code = text(office?.code);
    if (!code) return [];
    const address = office.address ?? {};
    return [{
      courier: "econt",
      code,
      name: text(office.name),
      city: text(address.city?.name),
      postcode: text(address.city?.postCode),
      address: text(address.fullAddress),
      lat: finiteNumber(address.location?.latitude),
      lng: finiteNumber(address.location?.longitude),
      hours: hoursRange(office.normalBusinessHoursFrom, office.normalBusinessHoursTo),
      isLocker: office.isAPS === true,
    }];
  });
}

/** The store prices only in EUR, so a price in any other currency is not shown. */
export function econtPriceFromResponse(json: unknown): number | null {
  const label = (json as { label?: { totalPrice?: unknown; currency?: unknown } } | null)?.label;
  const price = finiteNumber(label?.totalPrice);
  if (price === null || (label?.currency !== undefined && label.currency !== "EUR")) return null;
  return price;
}

async function econtPost(cfg: EcontConfig, path: string, body: unknown) {
  const response = await fetch(`${cfg.url.replace(/\/+$/, "")}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64")}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(COURIER_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Econt ${path} responded ${response.status}`);
  return response.json();
}

export async function fetchEcontOffices(cfg: EcontConfig): Promise<CourierOffice[]> {
  return econtOfficesFromResponse(await econtPost(cfg, "Nomenclatures/NomenclaturesService.getOffices.json", { countryCode: "BGR" }));
}

export async function quoteEcont(cfg: EcontConfig, officeCode: string, weightKg: number): Promise<number | null> {
  const json = await econtPost(cfg, "Shipments/LabelService.createLabel.json", {
    mode: "calculate",
    label: {
      senderClient: { name: "ЖОАН", phones: ["0884742770"] },
      senderAddress: { city: { country: { code3: "BGR" }, name: "Силистра", postCode: "7500" } },
      receiverClient: { name: "Клиент", phones: ["0888000000"] },
      receiverOfficeCode: officeCode,
      packCount: 1,
      shipmentType: "PACK",
      weight: weightKg,
    },
  });
  return econtPriceFromResponse(json);
}

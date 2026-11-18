import { COURIER_TIMEOUT_MS, finiteNumber, text, type CourierOffice } from "./types";

export type SpeedyConfig = { username: string; password: string };

const SPEEDY_URL = "https://api.speedy.bg/v1";
// shortcut: Bulgaria's Speedy country id per their docs (ISO 3166 numeric 100); confirm via /location/country once credentials exist.
const SPEEDY_BULGARIA_ID = 100;
/** "СТАНДАРТ 24 ЧАСА", the domestic service set on the store's MySpeedy account. */
export const SPEEDY_SERVICE_ID = 505;

export function speedyOfficesFromResponse(json: unknown): CourierOffice[] {
  const offices = (json as { offices?: unknown } | null)?.offices;
  if (!Array.isArray(offices)) return [];
  return offices.flatMap((raw): CourierOffice[] => {
    const office = raw as Record<string, any>;
    const code = finiteNumber(office?.id);
    if (code === null) return [];
    const address = office.address ?? {};
    const from = text(office.workingTimeFrom);
    const to = text(office.workingTimeTo);
    return [{
      courier: "speedy",
      code: String(code),
      name: text(office.name),
      city: text(address.siteName),
      postcode: text(address.postCode),
      address: text(address.fullAddressString),
      lat: finiteNumber(address.y),
      lng: finiteNumber(address.x),
      hours: from && to ? `${from}–${to}` : "",
      isLocker: office.type === "APT",
    }];
  });
}

export function speedyPriceFromResponse(json: unknown): number | null {
  const calculations = (json as { calculations?: unknown } | null)?.calculations;
  if (!Array.isArray(calculations)) return null;
  const result = calculations.find((item: any) => item?.serviceId === SPEEDY_SERVICE_ID) as { error?: unknown; price?: { total?: unknown; currency?: unknown } } | undefined;
  if (!result || result.error) return null;
  const total = finiteNumber(result.price?.total);
  if (total === null || (result.price?.currency !== undefined && result.price.currency !== "EUR")) return null;
  return total;
}

async function speedyPost(cfg: SpeedyConfig, path: string, body: Record<string, unknown>) {
  const response = await fetch(`${SPEEDY_URL}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ userName: cfg.username, password: cfg.password, language: "BG", ...body }),
    signal: AbortSignal.timeout(COURIER_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Speedy ${path} responded ${response.status}`);
  return response.json();
}

export async function fetchSpeedyOffices(cfg: SpeedyConfig): Promise<CourierOffice[]> {
  return speedyOfficesFromResponse(await speedyPost(cfg, "location/office", { countryId: SPEEDY_BULGARIA_ID }));
}

export async function quoteSpeedy(cfg: SpeedyConfig, officeCode: string, weightKg: number): Promise<number | null> {
  const pickupOfficeId = Number(officeCode);
  if (!Number.isInteger(pickupOfficeId)) return null;
  return speedyPriceFromResponse(await speedyPost(cfg, "calculate", {
    recipient: { privatePerson: true, pickupOfficeId },
    service: { serviceIds: [SPEEDY_SERVICE_ID] },
    content: { parcelsCount: 1, totalWeight: weightKg },
    payment: { courierServicePayer: "RECIPIENT" },
  }));
}

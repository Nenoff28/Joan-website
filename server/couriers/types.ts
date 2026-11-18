export type CourierId = "econt" | "speedy";

/** One courier office or locker, in the shape the checkout map and list use. */
export type CourierOffice = {
  courier: CourierId;
  code: string;
  name: string;
  city: string;
  postcode: string;
  address: string;
  lat: number | null;
  lng: number | null;
  hours: string;
  isLocker: boolean;
};

export const COURIER_TIMEOUT_MS = 8_000;

export function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

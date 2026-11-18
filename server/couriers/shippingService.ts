import { fetchEcontOffices, quoteEcont } from "./econt";
import { fetchSpeedyOffices, quoteSpeedy } from "./speedy";
import type { CourierId, CourierOffice } from "./types";

export type CourierAdapter = {
  listOffices: () => Promise<CourierOffice[]>;
  quote: (officeCode: string, weightKg: number) => Promise<number | null>;
};
type Adapters = Partial<Record<CourierId, CourierAdapter>>;

const OFFICES_TTL_MS = 24 * 3600_000;
const FAILED_OFFICES_TTL_MS = 5 * 60_000;
const QUOTE_TTL_MS = 15 * 60_000;
const QUOTES_PER_MINUTE = 30;

export function createShippingService(adapters: Adapters, options: { weightKg: number; now?: () => number }) {
  const now = options.now ?? Date.now;
  const officeCache = new Map<CourierId, { expiresAt: number; offices: CourierOffice[] }>();
  const quoteCache = new Map<string, { expiresAt: number; priceEur: number | null }>();
  const quotesByIp = new Map<string, { startedAt: number; count: number }>();

  async function officesFor(courier: CourierId, adapter: CourierAdapter) {
    const cached = officeCache.get(courier);
    if (cached && cached.expiresAt > now()) return cached.offices;
    try {
      const offices = await adapter.listOffices();
      officeCache.set(courier, { expiresAt: now() + OFFICES_TTL_MS, offices });
      return offices;
    } catch (error) {
      // A down courier must not break checkout; retry after a short pause instead of on every request.
      console.warn(`[shipping] ${courier} offices unavailable:`, error instanceof Error ? error.message : "unknown error");
      officeCache.set(courier, { expiresAt: now() + FAILED_OFFICES_TTL_MS, offices: [] });
      return [];
    }
  }

  function consumeQuoteLimit(ip: string) {
    const entry = quotesByIp.get(ip);
    if (!entry || now() - entry.startedAt >= 60_000) {
      quotesByIp.set(ip, { startedAt: now(), count: 1 });
      return;
    }
    if (entry.count >= QUOTES_PER_MINUTE) throw new Error("Твърде много заявки за цена. Опитайте след минута.");
    entry.count += 1;
  }

  return {
    configuredCouriers: Object.keys(adapters) as CourierId[],
    async offices(): Promise<CourierOffice[]> {
      const lists = await Promise.all((Object.entries(adapters) as [CourierId, CourierAdapter][]).map(([courier, adapter]) => officesFor(courier, adapter)));
      return lists.flat();
    },
    async quote(courier: CourierId, officeCode: string, ip: string): Promise<{ priceEur: number | null }> {
      consumeQuoteLimit(ip);
      const adapter = adapters[courier];
      if (!adapter) return { priceEur: null };
      const key = `${courier}:${officeCode}`;
      const cached = quoteCache.get(key);
      if (cached && cached.expiresAt > now()) return { priceEur: cached.priceEur };
      let priceEur: number | null = null;
      try {
        priceEur = await adapter.quote(officeCode, options.weightKg);
      } catch (error) {
        console.warn(`[shipping] ${courier} quote failed:`, error instanceof Error ? error.message : "unknown error");
        return { priceEur: null };
      }
      quoteCache.set(key, { expiresAt: now() + QUOTE_TTL_MS, priceEur });
      return { priceEur };
    },
  };
}

type RequestLike = { headers: Record<string, string | string[] | undefined>; ip?: string; socket?: { remoteAddress?: string } };

/** Express does not trust the hosting proxy here, so req.ip would be the proxy for every visitor; the first forwarded hop is the visitor.
 * shortcut: the header can be spoofed to dodge the price limit, which only protects the couriers' calculators; fine until abuse shows up. */
export function visitorAddress(request: RequestLike) {
  const forwarded = request.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  return (first || request.ip || request.socket?.remoteAddress || "unknown").slice(0, 128);
}

export function shippingAdaptersFromEnv(env: Record<string, string | undefined>): Adapters {
  const adapters: Adapters = {};
  if (env.ECONT_USERNAME && env.ECONT_PASSWORD) {
    const cfg = { url: env.ECONT_API_URL || "https://ee.econt.com/services", username: env.ECONT_USERNAME, password: env.ECONT_PASSWORD };
    adapters.econt = { listOffices: () => fetchEcontOffices(cfg), quote: (code, weight) => quoteEcont(cfg, code, weight) };
  }
  if (env.SPEEDY_USERNAME && env.SPEEDY_PASSWORD) {
    const cfg = { username: env.SPEEDY_USERNAME, password: env.SPEEDY_PASSWORD };
    adapters.speedy = { listOffices: () => fetchSpeedyOffices(cfg), quote: (code, weight) => quoteSpeedy(cfg, code, weight) };
  }
  return adapters;
}

let defaultService: ReturnType<typeof createShippingService> | null = null;
/** Built on first use so it reads the environment after dotenv has loaded. */
export function shippingService() {
  if (!defaultService) {
    const weightKg = Number(process.env.SHIPPING_DEFAULT_WEIGHT_KG);
    defaultService = createShippingService(shippingAdaptersFromEnv(process.env), { weightKg: Number.isFinite(weightKg) && weightKg > 0 ? weightKg : 2 });
  }
  return defaultService;
}

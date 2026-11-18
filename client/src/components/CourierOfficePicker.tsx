import { displayPrice } from "@/lib/price";
import { trpc } from "@/lib/trpc";
import { MapPin, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CourierId, CourierOffice } from "../../../server/couriers/types";

const COURIERS: Record<CourierId, { label: string; color: string }> = {
  speedy: { label: "Спиди", color: "#D71920" },
  econt: { label: "Еконт", color: "#1f3a93" },
};
const LIST_LIMIT = 50;
const BULGARIA: [number, number] = [42.7, 25.4];

function normalize(value: string) {
  return value.toLocaleLowerCase("bg-BG").replace(/\s+/g, " ").trim();
}

type Props = { selected: CourierOffice | null; onChange: (office: CourierOffice, priceEur: number | null) => void };

export function CourierOfficePicker({ selected, onChange }: Props) {
  const offices = trpc.shipping.offices.useQuery(undefined, { staleTime: 3600_000, retry: 1 });
  const [query, setQuery] = useState("");
  const [courierFilter, setCourierFilter] = useState<CourierId | "all">("all");
  const mapElement = useRef<HTMLDivElement>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const cluster = useRef<import("leaflet").LayerGroup | null>(null);
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const all = offices.data ?? [];
  const couriers = useMemo(() => (Object.keys(COURIERS) as CourierId[]).filter((id) => all.some((office) => office.courier === id)), [all]);
  const visible = useMemo(() => {
    const term = normalize(query);
    return all.filter((office) => (courierFilter === "all" || office.courier === courierFilter) && (!term || normalize(`${office.city} ${office.name} ${office.code} ${office.address}`).includes(term)));
  }, [all, query, courierFilter]);

  const quote = trpc.shipping.quote.useQuery(selected ? { courier: selected.courier, officeCode: selected.code } : { courier: "econt", officeCode: "-" }, { enabled: Boolean(selected), staleTime: 15 * 60_000, retry: false });
  useEffect(() => {
    if (selected && quote.data && !quote.isFetching) onChange(selected, quote.data.priceEur);
    // onChange is a parent setter; re-running on its identity would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote.data, quote.isFetching]);

  function choose(office: CourierOffice) {
    onChange(office, null);
  }

  // Leaflet touches window, so it loads only in the browser and only once this option is open.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const leafletModule = await import("leaflet");
      const L = ((leafletModule as { default?: typeof import("leaflet") }).default ?? leafletModule) as typeof import("leaflet");
      // The cluster plugin extends the global L, so it must be the same object the map uses.
      (window as unknown as { L: typeof L }).L = L;
      await import("leaflet.markercluster");
      await Promise.all([import("leaflet/dist/leaflet.css"), import("leaflet.markercluster/dist/MarkerCluster.css"), import("leaflet.markercluster/dist/MarkerCluster.Default.css")]);
      if (cancelled || !mapElement.current || map.current) return;
      leaflet.current = L;
      map.current = L.map(mapElement.current, { scrollWheelZoom: false }).setView(BULGARIA, 7);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(map.current);
      setMapReady(true);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const L = leaflet.current;
    if (!mapReady || !L || !map.current) return;
    cluster.current?.remove();
    const group = (L as any).markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45 }) as import("leaflet").LayerGroup;
    for (const office of visible) {
      if (office.lat === null || office.lng === null) continue;
      L.circleMarker([office.lat, office.lng], { radius: 7, color: "#fff", weight: 2, fillColor: COURIERS[office.courier].color, fillOpacity: 1 })
        .bindTooltip(`${COURIERS[office.courier].label} · ${office.name}`)
        .on("click", () => choose(office))
        .addTo(group);
    }
    group.addTo(map.current);
    cluster.current = group;
    const located = visible.filter((office) => office.lat !== null && office.lng !== null);
    if (query.trim() && located.length) map.current.fitBounds(L.latLngBounds(located.map((office) => [office.lat!, office.lng!])), { maxZoom: 14, padding: [24, 24] });
    // choose only calls onChange; listing it would rebuild every marker on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, visible]);

  useEffect(() => {
    if (selected?.lat != null && selected.lng != null) map.current?.setView([selected.lat, selected.lng], Math.max(map.current.getZoom(), 14));
  }, [selected]);

  if (offices.isSuccess && all.length === 0) return <p className="courier-picker-unavailable">Изборът на офис временно не е наличен. Изберете доставка до адрес или вземане от магазина.</p>;

  return (
    <div className="courier-picker">
      <div className="courier-picker-tools">
        <label className="courier-picker-search">
          <span className="sr-only">Търсене на офис</span>
          <Search size={17} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Град, офис или код" autoComplete="off" />
        </label>
        {couriers.length > 1 && (
          <div className="courier-picker-filter" role="group" aria-label="Куриер">
            {(["all", ...couriers] as const).map((id) => (
              <button key={id} type="button" aria-pressed={courierFilter === id} onClick={() => setCourierFilter(id)}>
                {id !== "all" && <i style={{ background: COURIERS[id].color }} aria-hidden="true" />}
                {id === "all" ? "Всички" : COURIERS[id].label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div ref={mapElement} className="courier-picker-map" role="presentation" />
      {offices.isLoading && <p className="courier-picker-note">Зареждане на офисите…</p>}
      {selected && (
        <div className="courier-picker-selected" aria-live="polite">
          <MapPin size={18} aria-hidden="true" />
          <div>
            <b>{COURIERS[selected.courier].label} · {selected.isLocker ? "автомат" : "офис"} {selected.name}</b>
            <span>{selected.address}{selected.hours && ` · ${selected.hours}`}</span>
            <strong>{quote.isFetching ? "Изчисляване на цената…" : quote.data?.priceEur != null ? `Ориентировъчна доставка: ${displayPrice(`${quote.data.priceEur.toFixed(2)}€`)}` : quote.error ? quote.error.message : "Цената ще бъде потвърдена от оператор."}</strong>
          </div>
        </div>
      )}
      <ul className="courier-picker-list" aria-label="Офиси">
        {visible.slice(0, LIST_LIMIT).map((office) => (
          <li key={`${office.courier}-${office.code}`}>
            <button type="button" aria-pressed={selected?.courier === office.courier && selected.code === office.code} onClick={() => choose(office)}>
              <i style={{ background: COURIERS[office.courier].color }} aria-hidden="true" />
              <span><b>{office.name}</b>{office.city} · {office.address}</span>
              <small>{COURIERS[office.courier].label}{office.isLocker ? " · автомат" : ""}</small>
            </button>
          </li>
        ))}
      </ul>
      {visible.length > LIST_LIMIT && <p className="courier-picker-note">Показани са първите {LIST_LIMIT} от {visible.length}. Уточнете търсенето по град или име.</p>}
      {offices.isSuccess && visible.length === 0 && <p className="courier-picker-note">Няма офис по това търсене.</p>}
    </div>
  );
}

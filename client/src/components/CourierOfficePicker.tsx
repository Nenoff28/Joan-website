import { displayPrice } from "@/lib/price";
import { trpc } from "@/lib/trpc";
import { Clock, MapPin, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CourierId, CourierOffice } from "../../../server/couriers/types";

const COURIERS: Record<CourierId, { label: string; color: string }> = {
  speedy: { label: "Спиди", color: "#D71920" },
  econt: { label: "Еконт", color: "#1f3a93" },
};
const LIST_LIMIT = 40;
const BULGARIA: [number, number] = [25.4, 42.75];
// OpenFreeMap: free vector tiles without an API key; "positron" is a quiet light style that lets the office dots lead.
const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

const keyOf = (office: Pick<CourierOffice, "courier" | "code">) => `${office.courier}:${office.code}`;
const normalize = (value: string) => value.toLocaleLowerCase("bg-BG").replace(/\s+/g, " ").trim();

type Props = { selected: CourierOffice | null; onChange: (office: CourierOffice, priceEur: number | null) => void };
type MapLibre = typeof import("maplibre-gl");

export function CourierOfficePicker({ selected, onChange }: Props) {
  const offices = trpc.shipping.offices.useQuery(undefined, { staleTime: 3600_000, retry: 1 });
  const [query, setQuery] = useState("");
  const [courierFilter, setCourierFilter] = useState<CourierId | "all">("all");
  const mapElement = useRef<HTMLDivElement>(null);
  const map = useRef<import("maplibre-gl").Map | null>(null);
  const lib = useRef<MapLibre | null>(null);
  const byKey = useRef(new Map<string, CourierOffice>());
  const choose = useRef<(office: CourierOffice) => void>(() => {});
  const [mapReady, setMapReady] = useState(false);

  const all = offices.data ?? [];
  const couriers = useMemo(() => (Object.keys(COURIERS) as CourierId[]).filter((id) => all.some((office) => office.courier === id)), [all]);
  const visible = useMemo(() => {
    const term = normalize(query);
    return all.filter((office) => (courierFilter === "all" || office.courier === courierFilter) && (!term || normalize(`${office.city} ${office.name} ${office.code} ${office.address}`).includes(term)));
  }, [all, query, courierFilter]);
  useEffect(() => {
    byKey.current = new Map(all.map((office) => [keyOf(office), office]));
  }, [all]);

  const quote = trpc.shipping.quote.useQuery(selected ? { courier: selected.courier, officeCode: selected.code } : { courier: "econt", officeCode: "-" }, { enabled: Boolean(selected), staleTime: 15 * 60_000, retry: false });
  useEffect(() => {
    if (selected && quote.data && !quote.isFetching) onChange(selected, quote.data.priceEur);
    // onChange is a parent setter; re-running on its identity would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote.data, quote.isFetching]);
  choose.current = (office) => onChange(office, null);

  // MapLibre touches window/WebGL, so it loads only in the browser and only once this option is open.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const maplibre = (await import("maplibre-gl")) as MapLibre;
      await import("maplibre-gl/dist/maplibre-gl.css");
      // The worker is a module with a shared chunk, so Vite must bundle it (a plain asset URL would miss the chunk).
      const { default: workerUrl } = await import("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url");
      maplibre.setWorkerUrl(workerUrl);
      if (cancelled || !mapElement.current || map.current) return;
      lib.current = maplibre;
      const instance = new maplibre.Map({ container: mapElement.current, style: MAP_STYLE, center: BULGARIA, zoom: 6.3, attributionControl: { compact: true }, cooperativeGestures: true });
      instance.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      instance.on("load", () => {
        const colour: any = ["match", ["get", "courier"], "speedy", COURIERS.speedy.color, COURIERS.econt.color];
        instance.addSource("offices", { type: "geojson", data: { type: "FeatureCollection", features: [] }, cluster: true, clusterRadius: 42, clusterMaxZoom: 13 });
        instance.addLayer({ id: "clusters", type: "circle", source: "offices", filter: ["has", "point_count"], paint: { "circle-color": "#232a2c", "circle-radius": ["step", ["get", "point_count"], 16, 25, 20, 100, 25], "circle-stroke-width": 3, "circle-stroke-color": "rgba(255,255,255,0.9)" } });
        instance.addLayer({ id: "cluster-count", type: "symbol", source: "offices", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Bold"], "text-size": 12 }, paint: { "text-color": "#ffffff" } });
        instance.addLayer({ id: "office-halo", type: "circle", source: "offices", filter: ["==", ["get", "key"], ""], paint: { "circle-radius": 17, "circle-color": colour, "circle-opacity": 0.22 } });
        instance.addLayer({ id: "office", type: "circle", source: "offices", filter: ["!", ["has", "point_count"]], paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 4, 12, 8, 16, 10], "circle-color": colour, "circle-stroke-width": 2.5, "circle-stroke-color": "#ffffff" } });
        instance.on("click", "clusters", async (event) => {
          const feature = event.features?.[0] as any;
          if (!feature) return;
          const zoom = await (instance.getSource("offices") as any).getClusterExpansionZoom(feature.properties.cluster_id);
          instance.easeTo({ center: feature.geometry.coordinates, zoom: zoom + 0.5 });
        });
        instance.on("click", "office", (event) => {
          const office = byKey.current.get(String(event.features?.[0]?.properties?.key));
          if (office) choose.current(office);
        });
        for (const layer of ["clusters", "office"]) {
          instance.on("mouseenter", layer, () => (instance.getCanvas().style.cursor = "pointer"));
          instance.on("mouseleave", layer, () => (instance.getCanvas().style.cursor = ""));
        }
        setMapReady(true);
      });
      map.current = instance;
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      setMapReady(false);
    };
  }, []);

  // Offices without coordinates stay in the list only.
  useEffect(() => {
    const instance = map.current;
    if (!mapReady || !instance) return;
    const located = visible.filter((office) => office.lat !== null && office.lng !== null);
    (instance.getSource("offices") as import("maplibre-gl").GeoJSONSource).setData({
      type: "FeatureCollection",
      features: located.map((office) => ({ type: "Feature", properties: { key: keyOf(office), courier: office.courier }, geometry: { type: "Point", coordinates: [office.lng!, office.lat!] } })),
    });
    if (query.trim() && located.length && lib.current) {
      const bounds = located.reduce((box, office) => box.extend([office.lng!, office.lat!]), new lib.current.LngLatBounds([located[0].lng!, located[0].lat!], [located[0].lng!, located[0].lat!]));
      instance.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 600 });
    }
  }, [mapReady, visible, query]);

  useEffect(() => {
    const instance = map.current;
    if (!mapReady || !instance) return;
    instance.setFilter("office-halo", ["==", ["get", "key"], selected ? keyOf(selected) : ""]);
    if (selected?.lat != null && selected.lng != null) instance.easeTo({ center: [selected.lng, selected.lat], zoom: Math.max(instance.getZoom(), 14), duration: 600 });
  }, [mapReady, selected]);

  if (offices.isSuccess && all.length === 0) return <p className="courier-unavailable">Изборът на офис временно не е наличен. Изберете доставка до адрес или вземане от магазина.</p>;

  const priceText = quote.isFetching ? "Изчисляваме…" : quote.data?.priceEur != null ? displayPrice(`${quote.data.priceEur.toFixed(2)}€`) : null;

  return (
    <div className="courier-picker">
      <div className="courier-find">
        <label className="courier-search">
          <span className="sr-only">Търсене на офис</span>
          <Search size={18} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Търсете по град, офис или код" autoComplete="off" />
          {query && <button type="button" className="courier-search-clear" onClick={() => setQuery("")} aria-label="Изчисти търсенето"><X size={16} /></button>}
        </label>
        {couriers.length > 1 && (
          <div className="courier-filter" role="group" aria-label="Куриер">
            {(["all", ...couriers] as const).map((id) => (
              <button key={id} type="button" aria-pressed={courierFilter === id} onClick={() => setCourierFilter(id)}>
                {id !== "all" && <i style={{ background: COURIERS[id].color }} aria-hidden="true" />}
                {id === "all" ? "Всички" : COURIERS[id].label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="courier-split">
        <div className="courier-map-wrap">
          <div ref={mapElement} className="courier-map" role="application" aria-label="Карта с офисите на Спиди и Еконт" />
          {offices.isLoading && <p className="courier-map-loading">Зареждаме офисите…</p>}
        </div>
        <div className="courier-side">
          {selected ? (
            <div className="courier-chosen" aria-live="polite">
              <span className="courier-badge" style={{ background: COURIERS[selected.courier].color }}>{COURIERS[selected.courier].label}</span>
              <b>{selected.isLocker ? "Автомат" : "Офис"} {selected.name}</b>
              <span className="courier-chosen-address"><MapPin size={15} aria-hidden="true" />{selected.address}</span>
              {selected.hours && <span className="courier-chosen-address"><Clock size={15} aria-hidden="true" />{selected.hours}</span>}
              <div className="courier-chosen-price">
                <span>Доставка</span>
                {priceText ? <strong>{priceText}</strong> : <em>цената се потвърждава от оператор</em>}
              </div>
              <small>Ориентировъчна цена за пратка до 2 кг.</small>
            </div>
          ) : (
            <p className="courier-hint"><MapPin size={18} aria-hidden="true" />Изберете офис от картата или от списъка.</p>
          )}
          <ul className="courier-list" aria-label="Офиси">
            {visible.slice(0, LIST_LIMIT).map((office) => {
              const active = selected?.courier === office.courier && selected.code === office.code;
              return (
                <li key={keyOf(office)}>
                  <button type="button" aria-pressed={active} onClick={() => choose.current(office)}>
                    <i style={{ background: COURIERS[office.courier].color }} aria-hidden="true" />
                    <span><b>{office.name}</b>{office.city}{office.address ? ` · ${office.address}` : ""}</span>
                    <small>{office.isLocker ? "автомат" : "офис"}</small>
                  </button>
                </li>
              );
            })}
            {offices.isSuccess && visible.length === 0 && <li className="courier-empty">Няма офис по това търсене.</li>}
          </ul>
          {visible.length > LIST_LIMIT && <p className="courier-more">Показани са {LIST_LIMIT} от {visible.length}. Уточнете търсенето по град или име.</p>}
        </div>
      </div>
    </div>
  );
}
